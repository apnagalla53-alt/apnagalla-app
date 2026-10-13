/** Quote tenant text and neutralize spreadsheet formulas in exported reports. */
export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const safe = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function downloadCsv(filename: string, headers: unknown[], rows: unknown[][], keepLink=false) {
  const blob = new Blob(['\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  if(!keepLink)setTimeout(() => URL.revokeObjectURL(url), 1000);
  return {filename,url};
}
