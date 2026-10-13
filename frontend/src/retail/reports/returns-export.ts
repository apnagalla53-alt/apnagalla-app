import api from '../../shared/api';
import { downloadCsv } from '../csv';

/** Download every authorized page for the selected Returns Report period. */
export async function downloadReturnsExport(filters: { from?: string; to?: string }) {
  let offset = 0;
  let headers: string[] | undefined;
  const rows: unknown[][] = [];
  for (;;) {
    const { data } = await api.get('/retail/account/exports/RETURNS', { params: { ...filters, offset, limit: 1000 } });
    if (!Array.isArray(data.headers) || !Array.isArray(data.rows)) throw new Error('Invalid returns export');
    if (!headers) headers = data.headers;
    else if (data.rows.length && JSON.stringify(headers) !== JSON.stringify(data.headers)) throw new Error('Returns export columns changed');
    rows.push(...data.rows);
    if (!data.hasMore) break;
    if (!Number.isInteger(data.nextOffset) || data.nextOffset <= offset) throw new Error('Invalid returns export page');
    offset = data.nextOffset;
  }
  // Save only after every page succeeds, so a failed request cannot look complete.
  downloadCsv('EVOLIX-returns.csv', headers || [], rows);
}
