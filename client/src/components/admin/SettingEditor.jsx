import React, { useEffect, useRef, useState } from 'react';
import { Badge, Spinner, btn, fieldClass } from '../learning/LearningUI';
import { errorMessage } from '../../lib/api';

/**
 * Edit one runtime setting in the console. The form is built from the value's
 * shape (switches for true/false, numbers, text, comma lists, nested groups);
 * the server validates on save and the error is shown here. `mapKeys` turns an
 * empty-by-default map (AI task -> model) into one field per key. Fields named
 * in `unlimited` are limits where 0 means no limit: shown empty, as
 * "Unlimited", and saved as 0 when cleared.
 */

const humanize = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function FieldFor({ name, value, onChange, disabled, path, unlimited = [] }) {
  const id = `set-${path.join('-')}`;
  if (typeof value === 'boolean') {
    return (
      <label htmlFor={id} className="flex items-center justify-between gap-3 py-1.5 text-sm text-gray-800">
        {humanize(name)}
        <input id={id} type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="h-4 w-4 accent-blue-600" />
      </label>
    );
  }
  if (typeof value === 'number' && unlimited.includes(name)) {
    return (
      <label htmlFor={id} className="block py-1 text-sm text-gray-700">
        {humanize(name)}
        <input id={id} type="number" min="0" step="any" value={value === 0 ? '' : value} placeholder="Unlimited" onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} disabled={disabled} className={`${fieldClass(false)} mt-1 py-1.5`} />
      </label>
    );
  }
  if (typeof value === 'number' || value === null) {
    return (
      <label htmlFor={id} className="block py-1 text-sm text-gray-700">
        {humanize(name)}
        <input id={id} type="number" step="any" value={value ?? ''} placeholder={value === null ? 'default' : undefined} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} disabled={disabled} className={`${fieldClass(false)} mt-1 py-1.5`} />
      </label>
    );
  }
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return (
      <label htmlFor={id} className="block py-1 text-sm text-gray-700">
        {humanize(name)} <span className="text-xs text-gray-500">(comma-separated, in order)</span>
        <input id={id} value={value.join(', ')} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} disabled={disabled} className={`${fieldClass(false)} mt-1 py-1.5`} />
      </label>
    );
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return (
      <fieldset className="rounded-lg border border-gray-200 px-3 py-2">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{humanize(name)}</legend>
        {Object.entries(value).map(([k, v]) => <FieldFor key={k} name={k} value={v} path={[...path, k]} disabled={disabled} unlimited={unlimited} onChange={(next) => onChange({ ...value, [k]: next })} />)}
      </fieldset>
    );
  }
  return (
    <label htmlFor={id} className="block py-1 text-sm text-gray-700">
      {humanize(name)}
      <input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`${fieldClass(false)} mt-1 py-1.5`} />
    </label>
  );
}

export default function SettingEditor({ title, description, value, onSave, onReset, editable = true, critical = false, source, mapKeys, unlimited, children }) {
  const expand = (v) => (mapKeys ? Object.fromEntries(mapKeys.map((k) => [k, v?.[k] || ''])) : v);
  const [draft, setDraft] = useState(() => expand(value));
  const [state, setState] = useState({ busy: false, error: null, saved: false });
  // Take a new saved value (after a save or a reload), but only when it really
  // changed: never on mount, which could otherwise overwrite a fast first edit.
  const seen = useRef(JSON.stringify(value));
  useEffect(() => {
    const next = JSON.stringify(value);
    if (next === seen.current) return;
    seen.current = next;
    setDraft(expand(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setState({ busy: true, error: null, saved: false });
    try {
      const out = mapKeys ? Object.fromEntries(Object.entries(draft).filter(([, v]) => v)) : draft;
      await onSave(out);
      setState({ busy: false, error: null, saved: true });
    } catch (err) {
      setState({ busy: false, error: errorMessage(err, 'Not saved.'), saved: false });
    }
  };

  const fields = draft && typeof draft === 'object' && !Array.isArray(draft) ? Object.entries(draft) : [];
  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
        </div>
        <div className="flex gap-1.5">
          {critical && <Badge tone="amber">superadmin</Badge>}
          {source && <Badge tone={source === 'db' ? 'blue' : 'gray'}>{source === 'db' ? 'changed' : source === 'env' ? 'from env' : 'default'}</Badge>}
        </div>
      </div>
      {children || (
        <div className="space-y-1">
          {fields.map(([k, v]) => <FieldFor key={k} name={k} value={v} path={[title, k]} disabled={!editable || state.busy} unlimited={unlimited} onChange={(next) => setDraft((d) => ({ ...d, [k]: next }))} />)}
        </div>
      )}
      {editable ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={state.busy} className={`${btn.primary} py-2`}>{state.busy ? <Spinner /> : null}Save</button>
          {onReset && source === 'db' && <button type="button" onClick={async () => { setState({ busy: true }); try { await onReset(); setState({ busy: false, saved: true }); } catch (err) { setState({ busy: false, error: errorMessage(err, 'Not reset.') }); } }} className={`${btn.ghost} py-2`}>Reset to default</button>}
          {state.saved && <span className="text-xs text-emerald-700" role="status">Saved</span>}
          {state.error && <span className="text-xs text-red-600" role="alert">{state.error}</span>}
        </div>
      ) : <p className="mt-3 text-xs text-gray-500">Only a superadmin can change this.</p>}
    </div>
  );
}

export { FieldFor, humanize };
