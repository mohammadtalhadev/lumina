'use client';

import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, FileUp, Upload, X } from 'lucide-react';
import { leadImportRowSchema } from '@/lib/validate';
import { Field, GhostButton, PrimaryButton, inputCls } from '@/components/ui';
import { cn } from '@/lib/cn';

const MAX_ROWS = 500;

/** Header aliases for auto-mapping: canonical field -> accepted header names. */
const ALIASES: Record<'contact_name' | 'email' | 'company' | 'niche', string[]> = {
  contact_name: ['contact_name', 'contactname', 'name', 'full_name', 'fullname', 'contact', 'person'],
  email: ['email', 'e-mail', 'mail', 'work_email', 'workemail', 'email_address'],
  company: ['company', 'organization', 'organisation', 'org', 'business', 'firm', 'clinic'],
  niche: ['niche', 'industry', 'vertical', 'sector', 'specialty'],
};

type Mapping = Record<'contact_name' | 'email' | 'company' | 'niche', string | ''>;

function autoMap(headers: string[]): Mapping {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const m: Mapping = { contact_name: '', email: '', company: '', niche: '' };
  (Object.keys(ALIASES) as (keyof Mapping)[]).forEach((field) => {
    for (const alias of ALIASES[field]) {
      const i = lower.indexOf(alias);
      if (i >= 0) {
        m[field] = headers[i];
        break;
      }
    }
  });
  return m;
}

type RowStatus = { ok: boolean; errors: string[] };

export default function CsvImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({ contact_name: '', email: '', company: '', niche: '' });
  const [parseError, setParseError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped_duplicates: number; invalid: { index: number; email: string; errors: string[] }[] } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mappedRows = useMemo(() => {
    if (!mapping.email || !mapping.company || !mapping.contact_name) return [];
    return records.map((r) => ({
      company: (r[mapping.company] ?? '').trim(),
      contact_name: (r[mapping.contact_name] ?? '').trim(),
      email: (r[mapping.email] ?? '').trim(),
      niche: mapping.niche ? (r[mapping.niche] ?? '').trim() : '',
    }));
  }, [records, mapping]);

  const statuses: RowStatus[] = useMemo(
    () =>
      mappedRows.map((row) => {
        const p = leadImportRowSchema.safeParse(row);
        return p.success
          ? { ok: true, errors: [] }
          : { ok: false, errors: p.error.issues.map((i) => `${String(i.path[0] ?? 'row')}: ${i.message}`) };
      }),
    [mappedRows]
  );

  const validCount = statuses.filter((s) => s.ok).length;
  const invalidCount = statuses.length - validCount;
  const mappingReady = Boolean(mapping.email && mapping.company && mapping.contact_name);

  function reset() {
    setFileName('');
    setHeaders([]);
    setRecords([]);
    setMapping({ contact_name: '', email: '', company: '', niche: '' });
    setParseError(null);
    setTruncated(false);
    setResult(null);
    setSubmitError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function close() {
    reset();
    onClose();
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setParseError(null);
    setResult(null);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length > 0 && res.data.length === 0) {
          setParseError('Could not read this CSV. Make sure it has a header row and comma-separated values.');
          return;
        }
        const hdrs = res.meta.fields ?? [];
        if (hdrs.length === 0) {
          setParseError('No header row found. The first row must name the columns.');
          return;
        }
        let recs = res.data as Record<string, string>[];
        let trunc = false;
        if (recs.length > MAX_ROWS) {
          recs = recs.slice(0, MAX_ROWS);
          trunc = true;
        }
        setFileName(f.name);
        setHeaders(hdrs);
        setRecords(recs);
        setMapping(autoMap(hdrs));
        setTruncated(trunc);
      },
    });
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: mappedRows }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(json.error ?? 'Import failed. Try again.');
        return;
      }
      setResult(json);
    } catch {
      setSubmitError('Network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function MappingSelect({ field, label, required }: { field: keyof Mapping; label: string; required?: boolean }) {
    return (
      <Field label={label} required={required}>
        <select
          className={inputCls}
          value={mapping[field]}
          onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
        >
          <option value="">{required ? 'Select a column…' : '— none —'}</option>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/30 p-4 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Import leads from CSV"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="glass-strong my-8 w-full max-w-2xl rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Import leads from CSV</h2>
              <button type="button" onClick={close} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-slate2 hover:bg-ink/5">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {result ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-emerald-50 p-4 text-center">
                    <p className="font-display text-2xl font-bold text-emerald-700">{result.imported}</p>
                    <p className="text-xs text-emerald-700/70">imported</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4 text-center">
                    <p className="font-display text-2xl font-bold text-amber-700">{result.skipped_duplicates}</p>
                    <p className="text-xs text-amber-700/70">skipped (duplicate)</p>
                  </div>
                  <div className="rounded-2xl bg-red-50 p-4 text-center">
                    <p className="font-display text-2xl font-bold text-red-700">{result.invalid.length}</p>
                    <p className="text-xs text-red-700/70">invalid</p>
                  </div>
                </div>
                {result.invalid.length > 0 && (
                  <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-2xl border border-red-100 bg-red-50/50 p-3 text-xs">
                    {result.invalid.slice(0, 20).map((r) => (
                      <p key={r.index} className="text-red-800">
                        <strong>Row {r.index + 1}</strong> ({r.email || 'no email'}): {r.errors.join('; ')}
                      </p>
                    ))}
                    {result.invalid.length > 20 && <p className="text-red-700/70">…and {result.invalid.length - 20} more.</p>}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <PrimaryButton onClick={() => { onDone(); close(); }}>Done</PrimaryButton>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={pickFile} aria-label="Choose CSV file" />
                {!fileName ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-ink/15 px-6 py-10 text-slate2 transition-colors hover:border-primary/50 hover:text-ink"
                  >
                    <FileUp className="h-8 w-8" aria-hidden />
                    <span className="font-medium">Choose a CSV file</span>
                    <span className="text-xs">Max {MAX_ROWS} rows per import · parsed in your browser, never uploaded raw</span>
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <p className="font-medium">{fileName} <span className="text-slate2">· {records.length} rows</span></p>
                      <GhostButton onClick={reset}>Choose another</GhostButton>
                    </div>
                    {truncated && (
                      <p className="flex items-center gap-1.5 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
                        <AlertTriangle className="h-4 w-4" aria-hidden />
                        File had more than {MAX_ROWS} rows — only the first {MAX_ROWS} will be imported.
                      </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MappingSelect field="contact_name" label="Name column" required />
                      <MappingSelect field="email" label="Email column" required />
                      <MappingSelect field="company" label="Company column" required />
                      <MappingSelect field="niche" label="Niche column" />
                    </div>
                    {mappingReady && (
                      <div className="rounded-2xl border border-white/70 bg-white/50 p-3">
                        <p className="mb-2 flex items-center gap-2 text-xs font-medium">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                          {validCount} valid · {invalidCount} invalid
                          <span className="font-normal text-slate2">(preview of first 5)</span>
                        </p>
                        <div className="space-y-1.5">
                          {mappedRows.slice(0, 5).map((r, i) => (
                            <div key={i} className={cn('rounded-xl px-3 py-2 text-xs', statuses[i]?.ok ? 'bg-white/70' : 'bg-red-50')}>
                              <p className="font-medium">{r.contact_name || '—'} <span className="font-normal text-slate2">· {r.company || '—'}</span></p>
                              <p className="text-slate2">{r.email || '—'}</p>
                              {!statuses[i]?.ok && (
                                <p className="mt-0.5 text-red-700">{statuses[i]?.errors.join('; ')}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {parseError && (
                  <p role="alert" className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{parseError}</p>
                )}
                {submitError && (
                  <p role="alert" className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{submitError}</p>
                )}

                <div className="flex justify-end gap-2">
                  <GhostButton onClick={close}>Cancel</GhostButton>
                  <PrimaryButton onClick={submit} disabled={!mappingReady || validCount === 0 || submitting}>
                    <Upload className="h-4 w-4" aria-hidden />
                    {submitting ? 'Importing…' : `Import ${validCount} lead${validCount === 1 ? '' : 's'}`}
                  </PrimaryButton>
                </div>
                <p className="text-xs text-slate2">Duplicate emails are skipped automatically. Every row is re-validated on the server.</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
