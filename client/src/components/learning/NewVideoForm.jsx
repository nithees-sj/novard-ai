import React, { useEffect, useRef, useState } from 'react';
import { FormPage, Field, fieldClass, btn } from './LearningUI';

const TITLE_MAX = 200;

const STEPS = [
  { title: 'Paste a link', text: 'Any YouTube video - we fetch its details and transcript.' },
  { title: 'Chat with it', text: 'Ask about any part of the video.' },
  { title: 'Summarize it', text: 'A structured recap with a diagram.' },
  { title: 'Quiz yourself', text: 'A custom quiz on what it covers.' },
];

/** The 11-character video id from any usual YouTube link (watch, youtu.be, shorts, embed, live). */
export function youtubeId(value) {
  const match = String(value || '').trim().match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?![\w-])/,
  );
  return match ? match[1] : null;
}

/**
 * "Add video" in the Video Summarizer, shown in the main area. Only the link
 * is needed: the title is optional (the video's own title is used), and a
 * preview confirms the link before anything is fetched.
 */
const NewVideoForm = ({ onSubmit, onCancel, onOpenExisting, existing = [], submitting = false, error = null, isFirst = false }) => {
  const [form, setForm] = useState({ videoUrl: '', title: '' });
  const [touched, setTouched] = useState(false);
  const linkRef = useRef(null);

  useEffect(() => { linkRef.current?.focus(); }, []);

  const url = form.videoUrl.trim();
  const title = form.title.trim();
  const id = youtubeId(url);
  const duplicate = id && existing.find((v) => v.videoId === id);

  const errors = {
    videoUrl: !url ? 'Paste a YouTube link.' : !id ? 'That does not look like a YouTube video link.' : duplicate ? 'You have already added this video.' : null,
    title: title.length > TITLE_MAX ? `Keep the title under ${TITLE_MAX} characters.` : null,
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (errors.videoUrl || errors.title || submitting) return;
    const ok = await onSubmit({ videoUrl: `https://www.youtube.com/watch?v=${id}`, title });
    if (ok) setForm({ videoUrl: '', title: '' });
  };

  return (
    <FormPage
      icon="video"
      title={isFirst ? 'Add your first video' : 'Add a video'}
      subtitle="Paste a YouTube link to chat with the video, summarize it and test yourself on it."
      steps={STEPS}
      onSubmit={submit}
      error={error}
      submitLabel="Add video"
      submitting={submitting}
      submittingLabel="Adding - fetching the details and transcript…"
      onCancel={onCancel}
    >
      <Field
        id="video-url"
        label="YouTube link"
        required
        error={(touched || duplicate) && errors.videoUrl}
        hint="youtube.com/watch, youtu.be, Shorts and embed links all work."
      >
        <input
          id="video-url"
          ref={linkRef}
          type="url"
          inputMode="url"
          value={form.videoUrl}
          onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
          placeholder="https://www.youtube.com/watch?v=…"
          className={fieldClass((touched || duplicate) && errors.videoUrl)}
          aria-invalid={Boolean((touched || duplicate) && errors.videoUrl)}
        />
      </Field>

      {id && (
        <div className="flex items-center gap-4 rounded-lg border border-line bg-sunken p-3">
          <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="aspect-video w-36 shrink-0 rounded-md bg-line object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">{duplicate ? duplicate.title : 'Video found'}</p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              {duplicate ? 'This video is already in your list.' : 'We will fetch its title, description and transcript when you add it.'}
            </p>
            {duplicate && onOpenExisting && (
              <button type="button" onClick={() => onOpenExisting(duplicate)} className={`${btn.ghost} -ml-3 mt-1 text-accent-fg`}>Open it</button>
            )}
          </div>
        </div>
      )}

      <Field
        id="video-title"
        label="Title"
        optional
        error={errors.title}
        count={form.title.length}
        max={TITLE_MAX}
        hint="Leave it empty to use the video's own title."
      >
        <input
          id="video-title"
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Docker networking explained"
          className={fieldClass(errors.title)}
        />
      </Field>
    </FormPage>
  );
};

export default NewVideoForm;
