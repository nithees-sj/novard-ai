import React, { useEffect, useRef, useState } from 'react';

// Matches the limit in models/doubtClearance.js.
const DESCRIPTION_MAX = 2000;

const STEPS = [
  { title: 'Describe it', text: 'Say what you are stuck on - we title it for you.' },
  { title: 'Get an answer', text: 'The AI tutor answers at once; ask follow-ups until it clicks.' },
  { title: 'Summarize it', text: 'A structured recap with a flowchart.' },
  { title: 'Practise', text: 'A custom quiz and hand-picked videos.' },
];

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const Counter = ({ value, max }) => {
  const near = value > max * 0.9;
  return (
    <span className={`text-xs tabular-nums ${value > max ? 'text-red-600 font-semibold' : near ? 'text-amber-600' : 'text-gray-400'}`}>
      {value}/{max}
    </span>
  );
};

/**
 * The "new doubt" form, shown in the main area of Doubt Clearance - whenever
 * no doubt is selected, and when "New doubt" is clicked. The student only
 * describes the doubt: the server writes a short, specific title from it, and
 * the question is sent to the tutor straight away.
 */
const NewDoubtForm = ({ onSubmit, onCancel, submitting = false, error = null, isFirstDoubt = false }) => {
  const [form, setForm] = useState({ description: '', imageUrl: '' });
  const [touched, setTouched] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const questionRef = useRef(null);

  useEffect(() => {
    questionRef.current?.focus();
  }, []);

  const description = form.description.trim();
  const imageUrl = form.imageUrl.trim();

  const errors = {
    description: !description
      ? 'Describe what you are stuck on.'
      : description.length < 15
        ? 'Add a little more detail so the tutor can help (at least 15 characters).'
        : description.length > DESCRIPTION_MAX ? `Keep the description under ${DESCRIPTION_MAX} characters.` : null,
    imageUrl: imageUrl && !isHttpUrl(imageUrl) ? 'Enter a full link starting with http:// or https://' : null,
  };
  const valid = !errors.description && !errors.imageUrl;

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (field === 'imageUrl') setImageFailed(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || submitting) return;
    const ok = await onSubmit({ description, imageUrl: imageUrl || '' });
    if (ok) setForm({ description: '', imageUrl: '' });
  };

  const fieldClass = (bad) =>
    `w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 ${
      bad ? 'border-red-400' : 'border-gray-300'
    }`;

  return (
    <div className="h-full overflow-y-auto">
      <form onSubmit={submit} className="max-w-3xl mx-auto p-6 space-y-6" noValidate>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isFirstDoubt ? 'Ask your first doubt' : 'Ask a new doubt'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Explain what is confusing you and the AI tutor will walk you through it.
          </p>
        </div>

        {/* How it works */}
        <ol className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start gap-2 mb-1">
                <span className="w-5 h-5 mt-px shrink-0 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-sm font-semibold text-gray-900">{step.title}</span>
              </div>
              <p className="text-xs text-gray-600">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label htmlFor="doubt-description" className="text-sm font-semibold text-gray-900">
                What's your doubt? <span className="text-red-500">*</span>
              </label>
              <Counter value={form.description.length} max={DESCRIPTION_MAX} />
            </div>
            <textarea
              id="doubt-description"
              ref={questionRef}
              value={form.description}
              onChange={set('description')}
              rows={7}
              placeholder={'What are you trying to understand or do?\nWhat have you tried so far?\nWhere exactly do you get stuck (error message, step, concept)?'}
              className={`${fieldClass(touched && errors.description)} resize-y min-h-[140px]`}
              aria-invalid={Boolean(touched && errors.description)}
            />
            {touched && errors.description
              ? <p className="mt-1 text-xs text-red-600">{errors.description}</p>
              : <p className="mt-1 text-xs text-gray-500">Include code, commands or error messages if you have them. We will give the doubt a short title from what you write.</p>}
          </div>

          <div>
            <label htmlFor="doubt-image" className="block text-sm font-semibold text-gray-900 mb-1.5">
              Screenshot or diagram link <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="doubt-image"
              type="url"
              value={form.imageUrl}
              onChange={set('imageUrl')}
              placeholder="https://..."
              className={fieldClass(touched && errors.imageUrl)}
              aria-invalid={Boolean(touched && errors.imageUrl)}
            />
            {touched && errors.imageUrl && <p className="mt-1 text-xs text-red-600">{errors.imageUrl}</p>}
            {imageUrl && isHttpUrl(imageUrl) && (
              imageFailed ? (
                <p className="mt-2 text-xs text-amber-700">That link does not load as an image. It will be saved as a link.</p>
              ) : (
                <img
                  src={imageUrl}
                  alt="Preview of the linked screenshot"
                  onError={() => setImageFailed(true)}
                  className="mt-3 max-h-48 rounded-lg border border-gray-200 object-contain bg-gray-50"
                />
              )
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
                Creating…
              </>
            ) : 'Ask the tutor'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default NewDoubtForm;
