// Tiny RFC-4180-style CSV parser (handles quotes, commas and newlines inside quotes).
// Pure function - used in the browser for the bulk-import page and in the self-test.

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const s = String(text || '').replace(/^﻿/, '');

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);

  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const rec = {};
    headers.forEach((h, idx) => {
      rec[h] = (r[idx] ?? '').trim();
    });
    return rec;
  });
  return { headers, records };
}

/** Builds CSV text (with a UTF-8 BOM so Excel shows accents correctly). */
export function toCSV(columns, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    // neutralise spreadsheet formulas in text coming from complainants
    const safe = /^[=+@-]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [columns.map((c) => esc(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => esc(r[c.key])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
