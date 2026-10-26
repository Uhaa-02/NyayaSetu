'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client';
import { parseCSV } from '@/lib/csv';
import { Card, ErrorBox, PageHeader, PriorityBadge, Spinner, SuccessBox } from '@/components/ui';

const REQUIRED = ['complainantName', 'complainantEmail', 'institution', 'state', 'title', 'description'];
const KNOWN = [...REQUIRED, 'complainantPhone', 'institutionId', 'documentUrl']; // the last three are optional
const MAX = 200;

export default function ImportPage() {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    setResult(null);
    setError('');
    setRows([]);
    if (!file) return;
    setFileName(file.name);
    if (file.size > 2 * 1024 * 1024) return setError('File is too large (max 2 MB).');
    const text = await file.text();
    const { headers, records } = parseCSV(text);
    const missing = REQUIRED.filter((h) => !headers.includes(h));
    if (missing.length) return setError(`Missing required column(s): ${missing.join(', ')}. Download the template to see the expected format.`);
    if (records.length === 0) return setError('The file has no data rows.');
    if (records.length > MAX) return setError(`Too many rows (${records.length}). Please upload at most ${MAX} at a time.`);
    setRows(records.map((r) => Object.fromEntries(KNOWN.map((k) => [k, r[k] ?? '']))));
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      setResult(await api('/api/complaints/bulk', { method: 'POST', body: { rows } }));
      setRows([]);
      setFileName('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Bulk import"
        subtitle="Upload a CSV of complaints received from other channels. Each row is validated, triaged, routed and assigned."
        actions={<a href="/sample-complaints.csv" download className="btn btn-secondary btn-sm">Download CSV template</a>}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="1. Choose a CSV file" subtitle={`Required columns: ${REQUIRED.join(', ')}. Optional: complainantPhone, institutionId (AICTE Permanent ID), documentUrl. Max ${MAX} rows.`}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-navy-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-navy-700"
            />
            {fileName ? <p className="mt-2 text-xs text-slate-500">Selected: {fileName}</p> : null}
            <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>
          </Card>

          {rows.length ? (
            <Card title="2. Review and import" subtitle={`${rows.length} row${rows.length === 1 ? '' : 's'} ready. Showing the first 5.`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="th px-2">Name</th>
                      <th className="th px-2">Institution</th>
                      <th className="th px-2">State</th>
                      <th className="th px-2">Title</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-2">{r.complainantName}</td>
                        <td className="px-2 py-2">{r.institution}</td>
                        <td className="px-2 py-2">{r.state}</td>
                        <td className="px-2 py-2">{r.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={submit} disabled={busy} className="btn btn-primary mt-4">
                {busy ? <Spinner /> : null}
                {busy ? 'Importing... this can take a few seconds' : `Import ${rows.length} complaint${rows.length === 1 ? '' : 's'}`}
              </button>
            </Card>
          ) : null}

          {result ? (
            <Card title="Import result">
              <SuccessBox>
                <strong>{result.created}</strong> complaint{result.created === 1 ? '' : 's'} imported
                {result.failed ? <>, <strong>{result.failed}</strong> row{result.failed === 1 ? '' : 's'} skipped</> : null}.
              </SuccessBox>
              {result.errors?.length ? (
                <div className="mt-4">
                  <p className="label">Skipped rows (spreadsheet row numbers)</p>
                  <ul className="space-y-1 text-sm text-red-700">
                    {result.errors.slice(0, 20).map((e) => (
                      <li key={e.row}>Row {e.row}: {e.errors.join(' ')}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.items?.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="th px-2">ID</th>
                        <th className="th px-2">Category</th>
                        <th className="th px-2">Priority</th>
                        <th className="th px-2">Routed to</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.items.slice(0, 15).map((i) => (
                        <tr key={i.complaintId}>
                          <td className="px-2 py-2 font-mono text-xs">{i.complaintId}</td>
                          <td className="px-2 py-2">{i.category}</td>
                          <td className="px-2 py-2"><PriorityBadge priority={i.priority} /></td>
                          <td className="px-2 py-2">{i.bureau}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.items.length > 15 ? <p className="mt-2 text-xs text-slate-500">Showing 15 of {result.items.length}.</p> : null}
                </div>
              ) : null}
              <Link href="/complaints" className="btn btn-secondary mt-4">View complaints</Link>
            </Card>
          ) : null}
        </div>

        <Card title="Tips">
          <ul className="list-inside list-disc space-y-2 text-sm text-slate-600">
            <li>State must be one of the supported states (the template lists examples).</li>
            <li>Descriptions need at least 20 characters so the triage engine has something to read.</li>
            <li>Quote fields that contain commas, e.g. <code className="rounded bg-slate-100 px-1">&quot;Fee, refund and receipts&quot;</code>.</li>
            <li>Imported complaints are tagged with the source &quot;Bulk Upload&quot; in the audit trail.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
