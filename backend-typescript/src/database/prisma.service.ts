import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { requestDatabaseScope } from './request-scope';

const atomicContext = new AsyncLocalStorage<Prisma.TransactionClient>();
type Operation = { model?: string; method: string; args: any[] };
const operations = new WeakMap<object, Operation>();

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [], // SQL errors can contain customer values. HTTP logging uses sanitized metadata.
    });
    const root = this;
    const delegateCache = new Map<string, any>();
    const execute = (operation: Operation, tx: any) =>
      operation.model
        ? tx[operation.model][operation.method](...operation.args)
        : tx[operation.method](...operation.args);
    const lazy = (operation: Operation) => {
      const scope = {
        ...(requestDatabaseScope.getStore() || { kind: 'system' as const }),
      };
      const run = () =>
        requestDatabaseScope.run(scope, () => {
          const tx = atomicContext.getStore();
          return tx
            ? execute(operation, tx)
            : root.scopedTransaction((inner) => execute(operation, inner));
        });
      const promise: any = {
        then: (ok: any, fail: any) => run().then(ok, fail),
        catch: (fail: any) => run().catch(fail),
        finally: (done: any) => run().finally(done),
        [Symbol.toStringTag]: 'PrismaPromise',
      };
      operations.set(promise, operation);
      return promise;
    };
    return new Proxy(this, {
      get(target, key) {
        if (key === '$transaction')
          return (work: any, options?: any) => {
            const active = atomicContext.getStore();
            const invoke = async (tx: any) =>
              typeof work === 'function'
                ? work(tx)
                : Promise.all(
                    work.map((promise: any) =>
                      operations.has(promise)
                        ? execute(operations.get(promise)!, tx)
                        : promise,
                    ),
                  );
            return active
              ? invoke(active)
              : root.scopedTransaction(invoke, options);
          };
        if (
          typeof key === 'string' &&
          [
            '$queryRaw',
            '$executeRaw',
            '$queryRawUnsafe',
            '$executeRawUnsafe',
          ].includes(key)
        )
          return (...args: any[]) => lazy({ method: key, args });
        const value: any = Reflect.get(target, key);
        if (
          typeof key === 'string' &&
          value &&
          typeof value === 'object' &&
          typeof value.findMany === 'function'
        ) {
          if (!delegateCache.has(key))
            delegateCache.set(
              key,
              new Proxy(value, {
                get(delegate, method) {
                  const member = delegate[method];
                  return typeof member === 'function'
                    ? (...args: any[]) =>
                        lazy({ model: key, method: String(method), args })
                    : member;
                },
              }),
            );
          return delegateCache.get(key);
        }
        return typeof value === 'function' ? value.bind(root) : value;
      },
    });
  }

  authorizeTenant(companyId: string) {
    const scope = requestDatabaseScope.getStore();
    if (scope) {
      scope.kind = 'tenant';
      scope.companyId = companyId;
    }
  }
  authorizePlatform() {
    const scope = requestDatabaseScope.getStore();
    if (scope) {
      scope.kind = 'system';
      delete scope.companyId;
    }
  }
  async runSystem<T>(work: () => Promise<T>): Promise<T> {
    const previous = requestDatabaseScope.getStore() || {
      kind: 'system' as const,
    };
    return requestDatabaseScope.run({ kind: 'system' }, async () => {
      const tx = atomicContext.getStore();
      if (!tx) return work();
      await tx.$executeRaw`SELECT set_config('app.security_scope','system',true),set_config('app.company_id','',true)`;
      try {
        return await work();
      } finally {
        await tx.$executeRaw`SELECT set_config('app.security_scope',${previous.kind},true),set_config('app.company_id',${previous.companyId || ''},true)`;
      }
    });
  }
  private async scopedTransaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: any,
  ): Promise<T> {
    const scope = requestDatabaseScope.getStore() || {
      kind: 'system' as const,
    };
    return super.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.security_scope',${scope.kind},true),set_config('app.company_id',${scope.companyId || ''},true)`;
        return atomicContext.run(tx, () => work(tx));
      },
      { timeout: 30000, maxWait: 10000, ...options },
    );
  }

  /** Reuses one transaction across existing posting services for request idempotency. */
  securitySystemQuery<T = unknown>(
    strings: TemplateStringsArray,
    ...values: any[]
  ): Promise<T> {
    return super.$queryRaw<T>(strings, ...values);
  }
  async runAtomic<T>(work: () => Promise<T>): Promise<T> {
    if (atomicContext.getStore()) return work();
    return this.scopedTransaction(() => work());
  }

  async onModuleInit() {
    this.logger.log('Connecting to Prisma database...');
    await this.$connect();
    if (process.env.NODE_ENV === 'production') {
      const [role] = await this.securitySystemQuery<
        {
          rolsuper: boolean;
          rolbypassrls: boolean;
          rolcreatedb: boolean;
          rolcreaterole: boolean;
        }[]
      >`SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user`;
      if (
        role.rolsuper ||
        role.rolbypassrls ||
        role.rolcreatedb ||
        role.rolcreaterole
      )
        throw new Error(
          'Production DATABASE_URL must use a least-privilege runtime role without superuser, BYPASSRLS or role/database creation privileges.',
        );
      const [ownership] = await this.securitySystemQuery<
        { owned: number }[]
      >`SELECT count(*)::int owned FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)`;
      if (ownership.owned > 0)
        throw new Error(
          'Production runtime must not own application tables. Use a separate migration owner.',
        );
      const [policies] = await this.securitySystemQuery<
        { protected: number }[]
      >`SELECT count(*)::int protected FROM pg_class WHERE relname IN ('items','parties','sales_invoices','attachments') AND relrowsecurity AND relforcerowsecurity`;
      if (policies.protected !== 4)
        throw new Error(
          'Production tenant row security is missing. Deploy the security migration before startup.',
        );
    }
  }

  async onModuleDestroy() {
    this.logger.log('Closing Prisma database connection...');
    await this.$disconnect();
  }
}
