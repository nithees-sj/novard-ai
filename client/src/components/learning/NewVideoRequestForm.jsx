import React, { useEffect, useRef, useState } from 'react';
import { FormPage, Field, fieldClass } from './LearningUI';

// Matches the limits in server/services/videoRequestService.js.
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 1000;

const STEPS = [
  { title: 'Describe your goal', text: 'What you want to learn and your level.' },
  { title: 'We search YouTube', text: 'The AI picks focused search terms for you.' },
  { title: 'Watch the best picks', text: 'Popular, relevant videos - refresh any time.' },
];

const EXAMPLES = [
  { title: 'React hooks', description: 'Beginner. I know basic JavaScript and want to understand useState and useEffect.' },
  { title: 'SQL joins', description: 'Intermediate. Focus on inner vs left joins with practical examples.' },
  { title: 'Docker for developers', description: 'Beginner. I want to containerise a Node.js app and use docker compose.' },
  { title: 'System design basics', description: 'Preparing for interviews: load balancing, caching and databases.' },
];

/**
 * "New request" in the Video Library, shown in the main area: what the
 * student wants to learn and at what level; videos are found right after.
 */
const NewVideoRequestForm = ({ onSubmit, onCancel, submitting = false, error = null, isFirst = false }) => {
  const [form, setForm] = useState({ title: '', description: '' });
  const [touched, setTouched] = useState(false);
  const topicRef = useRef(null);

  useEffect(() => { topicRef.current?.focus(); }, []);

  const title = form.title.trim();
  const description = form.description.trim();
  const errors = {
    title: !title ? 'Say what you want to learn.' : title.length > TITLE_MAX ? `Keep it under ${TITLE_MAX} characters.` : null,
    description: !description ? 'Add your level and what to focus on - it makes the results much better.'
      : description.length > DESCRIPTION_MAX ? `Keep it under ${DESCRIPTION_MAX} characters.` : null,
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (errors.title || errors.description || submitting) return;
    const ok = await onSubmit({ title, description, platform: 'youtube' });
    if (ok) setForm({ title: '', description: '' });
  };

  return (
    <FormPage
      icon="video"
      title={isFirst ? 'Find your first learning videos' : 'Find learning videos'}
      subtitle="Tell us what you want to learn and we will recommend the best YouTube videos for it."
      steps={STEPS}
      onSubmit={submit}
      error={error}
      submitLabel="Find videos"
      submitting={submitting}
      submittingLabel="Saving your request…"
      onCancel={onCancel}
    >
      <Field id="request-title" label="What do you want to learn?" required error={touched && errors.title} count={form.title.length} max={TITLE_MAX}>
        <input
          id="request-title"
          ref={topicRef}
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="e.g. React hooks, SQL joins, Kubernetes basics"
          className={fieldClass(touched && errors.title)}
          aria-invalid={Boolean(touched && errors.title)}
        />
      </Field>

      <div className="-mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-gray-500">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.title}
            type="button"
            onClick={() => setForm(ex)}
            className="rounded-full border border-gray-200 bg-surface px-2.5 py-1 text-xs text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            {ex.title}
          </button>
        ))}
      </div>

      <Field
        id="request-description"
        label="Your level and focus"
        required
        error={touched && errors.description}
        hint="e.g. beginner or intermediate, what you already know, and what you want to be able to do."
        count={form.description.length}
        max={DESCRIPTION_MAX}
      >
        <textarea
          id="request-description"
          rows={4}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Beginner. I know basic JavaScript and want to build small React apps."
          className={`${fieldClass(touched && errors.description)} resize-y`}
          aria-invalid={Boolean(touched && errors.description)}
        />
      </Field>

      <p className="flex items-center gap-2 text-xs text-gray-500">
        <span className="rounded-md bg-red-50 px-1.5 py-0.5 font-semibold text-red-600 ring-1 ring-red-100">YouTube</span>
        Videos are found on YouTube.
      </p>
    </FormPage>
  );
};

export default NewVideoRequestForm;
