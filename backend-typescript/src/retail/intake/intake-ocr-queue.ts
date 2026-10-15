import { PrismaService } from '../../database/prisma.service';
import { requestDatabaseScope } from '../../database/request-scope';
import type { StorageService } from '../../attachments/storage/storage.interface';
import type { OcrProvider } from './ocr-provider';
import { parseInvoiceText } from './intake-parser';
import { intakeCatalog, matchIntakeRow } from './intake-matching';
import { randomUUID } from 'node:crypto';

/** Persistent queue uses the existing import jobs. Claim once, perform OCR outside
 * all SQL transactions, then publish a review draft only if the lease still owns it. */
export async function processNextIntakeDocument(
  db: PrismaService,
  storage: StorageService,
  provider: OcrProvider,
) {
  const lease = randomUUID();
  const job = await db.runSystem(() =>
    db.runAtomic(async () => {
      const rows = await db.$queryRaw<
        any[]
      >`SELECT id FROM retail_import_jobs WHERE preset='UNIVERSAL_INTAKE' AND status='RECEIVED' AND kind='INTAKE_PURCHASE' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows.length) return null;
      const job = await db.retailImportJob.findUniqueOrThrow({
          where: { id: rows[0].id },
        }),
        config: any = job.configuration;
      return db.retailImportJob.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSING',
          configuration: {
            ...config,
            lease,
            stage: 'Preparing the photo',
            processing_at: new Date().toISOString(),
          },
        },
      });
    }),
  );
  if (!job) return false;
  await requestDatabaseScope.run(
    { kind: 'tenant', companyId: job.company_id },
    async () => {
      let config: any = job.configuration;
      const stage = async (label: string) => {
        await db.runAtomic(async () => {
          await db.$queryRaw`SELECT id FROM retail_import_jobs WHERE id=${job.id}::uuid FOR UPDATE`;
          const current = await db.retailImportJob.findUniqueOrThrow({
            where: { id: job.id },
          });
          if (
            current.status !== 'PROCESSING' ||
            (current.configuration as any).lease !== lease
          )
            throw Error('Lease lost');
          config = { ...(current.configuration as any), stage: label };
          await db.retailImportJob.update({
            where: { id: job.id },
            data: { configuration: config },
          });
        });
      };
      try {
        if (
          config.storage_provider !== (process.env.STORAGE_PROVIDER || 'local')
        )
          throw Error('Storage unavailable');
        const result = await provider.extractDocument(
          await storage.get(config.document_key),
          stage,
        );
        const parsed = parseInvoiceText(result.text, result.confidence);
        if (!parsed.rows.length || parsed.rows.length > 200)
          throw Error('No reliable rows');
        await stage('Matching items in your shop');
        const catalog = await intakeCatalog(db, job.company_id);
        await db.runAtomic(async () => {
          await db.$queryRaw`SELECT id FROM retail_import_jobs WHERE id=${job.id}::uuid FOR UPDATE`;
          const current = await db.retailImportJob.findUniqueOrThrow({
            where: { id: job.id },
          });
          if (
            current.status !== 'PROCESSING' ||
            (current.configuration as any).lease !== lease
          )
            return;
          await db.retailImportRow.deleteMany({ where: { job_id: job.id } });
          await db.retailImportRow.createMany({
            data: parsed.rows.map((r, index) => ({
              job_id: job.id,
              number: index + 1,
              source: { line: index + 1 },
              normalized: JSON.parse(
                JSON.stringify(matchIntakeRow(r, catalog)),
              ),
              errors: ['Check the photo and confirm all extracted values.'],
              status: 'NEEDS_REVIEW',
            })),
          });
          await db.retailImportJob.update({
            where: { id: job.id },
            data: {
              status: 'NEEDS_REVIEW',
              configuration: {
                ...config,
                header: parsed.header,
                initial_rows: parsed.rows.length,
                initial_review_rows: parsed.rows.length,
                stage: 'Ready to review',
                unparsed_lines: parsed.unparsed_lines,
                notice:
                  'Only rows with a clear name, quantity, unit, rate and amount could be read. Compare every row and the final total with your photo. Nothing has been posted.',
              },
            },
          });
          await db.auditLog.create({
            data: {
              company_id: job.company_id,
              branch_id: job.branch_id,
              user_id: job.user_id,
              action: 'INTAKE_SUPPLIER_BILL_PROCESSED',
              details: JSON.stringify({ count: parsed.rows.length }),
            },
          });
        });
      } catch {
        await db.runAtomic(async () => {
          await db.$queryRaw`SELECT id FROM retail_import_jobs WHERE id=${job.id}::uuid FOR UPDATE`;
          const current = await db.retailImportJob.findUniqueOrThrow({
            where: { id: job.id },
          });
          if (
            current.status !== 'PROCESSING' ||
            (current.configuration as any).lease !== lease
          )
            return;
          await db.retailImportJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              configuration: {
                ...(current.configuration as any),
                stage: 'Could not read enough details',
                error:
                  "We couldn't read enough details from this bill. No purchase was saved. Retake the photo, choose another photo, or enter the purchase manually.",
              },
            },
          });
          await db.auditLog.create({
            data: {
              company_id: job.company_id,
              branch_id: job.branch_id,
              user_id: job.user_id,
              action: 'INTAKE_SUPPLIER_BILL_FAILED',
            },
          });
        });
      }
    },
  );
  return true;
}

export async function cleanExpiredIntakeDocuments(
  db: PrismaService,
  storage: StorageService,
) {
  const rows = await db.runSystem(
    () =>
      db.$queryRaw<
        { id: string; company_id: string }[]
      >`SELECT id, company_id FROM retail_import_jobs WHERE preset='UNIVERSAL_INTAKE' AND ((configuration ? 'document_key' AND (created_at < NOW() - INTERVAL '7 days' OR status='CANCELLED')) OR (created_at < NOW() - INTERVAL '90 days' AND COALESCE(configuration->>'redacted','false') <> 'true')) ORDER BY created_at LIMIT 100`,
  );
  for (const row of rows)
    await requestDatabaseScope.run(
      { kind: 'tenant', companyId: row.company_id },
      () =>
        db.runAtomic(async () => {
          await db.$queryRaw`SELECT id FROM retail_import_jobs WHERE id=${row.id}::uuid FOR UPDATE`;
          const job = await db.retailImportJob.findUniqueOrThrow({
              where: { id: row.id },
            }),
            c: any = { ...(job.configuration as object) };
          if (c.document_key) {
            if (
              c.storage_provider !== (process.env.STORAGE_PROVIDER || 'local')
            )
              return;
            await storage.delete(c.document_key);
            delete c.document_key;
          }
          if (
            Date.now() - job.created_at.getTime() > 90 * 86400000 &&
            !c.redacted
          ) {
            await db.retailImportRow.deleteMany({ where: { job_id: job.id } });
            await db.retailImportJob.update({
              where: { id: job.id },
              data: {
                configuration: {
                  source: c.source,
                  universal_intake: true,
                  purchase_id: c.purchase_id || null,
                  redacted: true,
                },
                headers: [],
                status: job.status === 'CONFIRMED' ? 'CONFIRMED' : 'CANCELLED',
              },
            });
          } else
            await db.retailImportJob.update({
              where: { id: job.id },
              data: { configuration: c },
            });
        }),
    );
}
