import React, { useState } from 'react';
import TagInput from './TagInput';

/**
 * The editable body of a draft card. The fields come from the server
 * (action.meta.fields), so each kind of draft is described in one place:
 * server/agent/actions.js. Each field shows where its value came from when
 * that is worth checking ("from your profile", "assumed").
 */

const SOURCE = {
  profile: { text: 'from your profile', className: 'bg-blue-50 text-blue-700' },
  assumed: { text: 'assumed - check', className: 'bg-amber-50 text-amber-700' },
};

const inputClass = 'w-full rounded-lg border border-gray-200 bg-surface px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

function problemFor(f, v) {
  const required = f.need === 'must' || f.need === 'auto';
  if (f.type === 'tags' || f.type === 'video') return null;
  if (v === undefined || v === null || String(v).trim() === '') return required ? `${f.label} is required.` : null;
  if (f.type === 'int') {
    const n = Number(v);
    if (!Number.isInteger(n) || n < f.min || n > f.max) return `${f.label} must be between ${f.min} and ${f.max}.`;
  }
  if ((f.type === 'text' || f.type === 'textarea') && f.min && String(v).trim().length < f.min) return `${f.label} needs a bit more detail.`;
  return null;
}

const VideoPicker = ({ candidates = [], value, onChange }) => (
  <div className="space-y-2" role="radiogroup">
    {candidates.map((c) => {
      const active = c.videoId === value;
      return (
        <label key={c.videoId} className={`flex cursor-pointer gap-3 rounded-lg border p-2 transition ${active ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}>
          <input type="radio" name="video" className="sr-only" checked={active} onChange={() => onChange(c.videoId)} />
          <span className="relative shrink-0 w-32 aspect-video overflow-hidden rounded-md bg-gray-100">
            <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            {c.duration && <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[10px] font-medium text-white">{c.duration}</span>}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900 line-clamp-2">{c.title}</span>
            {c.channelName && <span className="mt-0.5 block text-xs text-gray-500">{c.channelName}</span>}
            <a href={`https://www.youtube.com/watch?v=${c.videoId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mt-1 inline-block text-xs text-blue-600 hover:underline">Preview ↗</a>
          </span>
        </label>
      );
    })}
  </div>
);

function Input({ f, value, onChange, id, candidates }) {
  if (f.type === 'video') return <VideoPicker candidates={candidates} value={value} onChange={onChange} />;
  if (f.type === 'tags') return <TagInput id={id} value={value || []} onChange={onChange} max={f.maxItems || 20} />;
  if (f.type === 'textarea') return <textarea id={id} rows={3} value={value ?? ''} maxLength={f.max} onChange={(e) => onChange(e.target.value)} className={`${inputClass} resize-y`} />;
  if (f.type === 'int') return <input id={id} type="number" min={f.min} max={f.max} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={`${inputClass} w-28`} />;
  if (f.type === 'select') {
    if (f.options.length <= 4) {
      return (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" id={id}>
          {f.options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={value === o.value}
              onClick={() => onChange(value === o.value && f.need === 'should' ? '' : o.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${value === o.value ? 'border-blue-500 bg-blue-600 text-white' : 'border-gray-200 bg-surface text-gray-700 hover:border-gray-300'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    }
    return (
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${inputClass} w-auto`}>
        {f.need === 'should' && <option value="">-</option>}
        {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return <input id={id} type="text" value={value ?? ''} maxLength={f.max} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
}

const DraftForm = ({ action, confirmLabel, onCreate, onCancel, busy }) => {
  const fields = action.meta?.fields || [];
  const [values, setValues] = useState(() => ({ ...(action.args || {}) }));
  const [remember, setRemember] = useState(false);
  const [touched, setTouched] = useState(false);

  const problems = fields.map((f) => problemFor(f, values[f.key])).filter(Boolean);
  const set = (key) => (v) => setValues((cur) => ({ ...cur, [key]: v }));

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (problems.length) return;
    // Only the draft's own fields are sent; the server re-checks them.
    const edits = Object.fromEntries(fields.map((f) => [f.key, values[f.key] === '' ? null : values[f.key]]).filter(([, v]) => v !== undefined));
    onCreate(edits, remember);
  };

  return (
    <form onSubmit={submit}>
      <div className="space-y-3 px-4 py-3">
        {fields.map((f) => {
          const source = SOURCE[action.provenance?.[f.key]];
          const id = `${action.id}-${f.key}`;
          return (
            <div key={f.key}>
              <div className="mb-1 flex items-center gap-2">
                <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{f.label}</label>
                {source && <span className={`rounded px-1.5 py-px text-[10px] font-medium ${source.className}`}>{source.text}</span>}
              </div>
              <Input f={f} id={id} value={values[f.key]} onChange={set(f.key)} candidates={action.args?.candidates} />
            </div>
          );
        })}
        {touched && problems.length > 0 && <p className="text-sm text-red-600" role="alert">{problems[0]}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
        {action.meta?.rememberable && (
          <label className="mr-auto flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300" />
            Remember these details for next time
          </label>
        )}
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
        <button type="submit" disabled={busy} className="rounded-lg bg-ink px-3.5 py-1.5 text-sm font-semibold text-on-ink hover:bg-ink-hover disabled:opacity-50">{confirmLabel}</button>
      </div>
    </form>
  );
};

export default DraftForm;
