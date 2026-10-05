import React, { useState } from 'react';
import { FORUM_CATEGORIES } from '../lib/forum';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Icon from './ui/Icon';
import { Field, Input, Textarea } from './ui/Field';

const IssueForm = ({ onSubmit, onCancel, isVisible }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    category: 'general'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      setFormError('Please fill in both the title and the description.');
      return;
    }
    setFormError(null);

    setIsSubmitting(true);
    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      // The author is the signed-in student; the server takes that from the session.
      await onSubmit({ ...formData, tags: tagsArray });

      setFormData({
        title: '',
        description: '',
        tags: '',
        category: 'general'
      });
    } catch (error) {
      setFormError(error.message || 'Could not create the discussion. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isVisible}
      onClose={onCancel}
      dismissible={!isSubmitting}
      title="New discussion"
      description="Ask a question, share something you made or start a conversation. Novard's AI assistant usually posts a first answer within a minute."
      size="lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="new-discussion" loading={isSubmitting} loadingLabel="Posting…">Post discussion</Button>
        </>
      )}
    >
      <form id="new-discussion" onSubmit={handleSubmit} className="space-y-5">
        <Field id="title" label="Title" required>
          <Input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="One line: what is this about?"
            required
            data-autofocus
          />
        </Field>

        <Field id="description" label="Description" required hint="Include what you tried, any error messages, and what you expected to happen.">
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={6}
            placeholder="Give the details someone needs to help."
            required
          />
        </Field>

        <fieldset>
          <legend className="mb-2 text-small font-medium text-fg">Category</legend>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
            {FORUM_CATEGORIES.map((c) => {
              const on = formData.category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setFormData((prev) => ({ ...prev, category: c.value }))}
                  className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-small font-medium ring-1 ring-inset transition-colors duration-150 ${
                    on ? 'bg-accent-soft text-accent-fg ring-accent/40' : 'text-fg-muted ring-line hover:bg-sunken hover:text-fg'
                  }`}
                >
                  <Icon name={c.icon} className="h-3.5 w-3.5" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field id="tags" label="Tags" optional hint="Separate with commas, e.g. javascript, react, bug">
          <Input id="tags" name="tags" value={formData.tags} onChange={handleChange} placeholder="javascript, react" />
        </Field>

        {formError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-body text-danger-fg">{formError}</p>
        )}
      </form>
    </Modal>
  );
};

export default IssueForm;
