import React, { useState } from 'react';

/** A list of short values as removable chips; Enter or comma adds one. */
const TagInput = ({ value = [], onChange, max = 20, placeholder = 'Type and press Enter', id }) => {
  const [text, setText] = useState('');

  const add = (raw) => {
    const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const seen = new Set(value.map((v) => v.toLowerCase()));
    const next = [...value];
    parts.forEach((p) => { if (!seen.has(p.toLowerCase()) && next.length < max) { seen.add(p.toLowerCase()); next.push(p); } });
    onChange(next);
    setText('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-surface px-2 py-1.5 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="text-gray-400 hover:text-gray-700" aria-label={`Remove ${tag}`}>×</button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(text); }
          if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(text)}
        placeholder={value.length ? '' : placeholder}
        disabled={value.length >= max}
        className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder-gray-400"
      />
    </div>
  );
};

export default TagInput;
