import React, { useEffect, useRef, useState } from 'react';
import { FormPage, Field, fieldClass } from './learning/LearningUI';

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

  return (
    <FormPage
      icon="doubt"
      title={isFirstDoubt ? 'Ask your first doubt' : 'Ask a new doubt'}
      subtitle="Explain what is confusing you and the AI tutor will walk you through it."
      steps={STEPS}
      onSubmit={submit}
      error={error}
      submitLabel="Ask the tutor"
      submitting={submitting}
      submittingLabel="Creating…"
      onCancel={onCancel}
    >
      <Field
        id="doubt-description"
        label="What's your doubt?"
        required
        error={touched && errors.description}
        hint="Include code, commands or error messages if you have them. We will give the doubt a short title from what you write."
        count={form.description.length}
        max={DESCRIPTION_MAX}
      >
        <textarea
          id="doubt-description"
          ref={questionRef}
          value={form.description}
          onChange={set('description')}
          rows={7}
          placeholder={'What are you trying to understand or do?\nWhat have you tried so far?\nWhere exactly do you get stuck (error message, step, concept)?'}
          className={`${fieldClass(touched && errors.description)} min-h-[140px] resize-y`}
          aria-invalid={Boolean(touched && errors.description)}
        />
      </Field>

      <Field id="doubt-image" label="Screenshot or diagram link" optional error={touched && errors.imageUrl}>
        <input
          id="doubt-image"
          type="url"
          value={form.imageUrl}
          onChange={set('imageUrl')}
          placeholder="https://..."
          className={fieldClass(touched && errors.imageUrl)}
          aria-invalid={Boolean(touched && errors.imageUrl)}
        />
        {imageUrl && isHttpUrl(imageUrl) && (
          imageFailed ? (
            <p className="mt-2 text-xs text-warning-fg">That link does not load as an image. It will be saved as a link.</p>
          ) : (
            <img
              src={imageUrl}
              alt="Preview of the linked screenshot"
              onError={() => setImageFailed(true)}
              className="mt-3 max-h-48 rounded-lg border border-line bg-sunken object-contain"
            />
          )
        )}
      </Field>
    </FormPage>
  );
};

export default NewDoubtForm;
