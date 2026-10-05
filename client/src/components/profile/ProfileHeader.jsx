import React, { useEffect, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../AuthContext';
import { inputClass } from '../learning/LearningUI';
import UIIcon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';


const formatDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString(undefined, opts) : '—';

function relative(d) {
  if (!d) return 'No activity yet';
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : days < 30 ? `${days} days ago` : formatDate(d);
}

const Detail = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-caption text-fg-subtle">{label}</dt>
    <dd className="mt-0.5 truncate text-body text-fg">{children}</dd>
  </div>
);

/**
 * Identity card at the top of the profile: photo, name, contact details, bio
 * and the student's current goal. "Edit profile" swaps the details for a form.
 */
const ProfileHeader = ({ account, goal, fallbackPicture, onSaved }) => {
  const { updateSession } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setForm({ name: account.name || '', mobile: account.mobile || '', bio: account.bio || '' });
  }, [account.name, account.mobile, account.bio]);

  const picture = account.picture || fallbackPicture;

  const save = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const mobile = form.mobile.trim();
    if (!name) return setNotice({ type: 'error', text: 'Please enter your name.' });
    if (mobile && !/^\+?[\d\s()-]{7,20}$/.test(mobile)) return setNotice({ type: 'error', text: 'Please enter a valid phone number.' });
    setSaving(true);
    setNotice(null);
    try {
      const { data } = await api.post('/updateUserProfile', { name, mobile, bio: form.bio.trim() });
      if (!data.success) throw new Error('not saved');
      // The response carries a fresh session with the new name, used by the forum and the agent.
      if (data.token) updateSession({ token: data.token, user: data.user });
      onSaved?.({ name, mobile, bio: form.bio.trim() });
      setEditing(false);
      setNotice({ type: 'success', text: 'Profile updated.' });
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err, 'Could not save your profile. Please try again.') });
    } finally {
      setSaving(false);
    }
  };

  const input = inputClass;

  return (
    <section aria-label="Your details">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar src={picture} name={account.name || account.email} size="xl" />
            <div className="min-w-0">
              <h1 className="truncate text-display font-semibold text-fg">{account.name || 'Your profile'}</h1>
              <p className="truncate text-body text-fg-subtle">{account.email}</p>
            </div>
          </div>
          {!editing && (
            <Button variant="secondary" icon="edit" onClick={() => { setEditing(true); setNotice(null); }}>Edit profile</Button>
          )}
        </div>

        {notice && (
          <p role={notice.type === 'error' ? 'alert' : 'status'} className={`mt-5 rounded-lg px-4 py-2.5 text-body ${notice.type === 'error' ? 'bg-danger-soft text-danger-fg' : 'bg-success-soft text-success-fg'}`}>
            {notice.text}
          </p>
        )}

        {editing ? (
          <form onSubmit={save} className="mt-6 grid max-w-3xl gap-5 rounded-xl bg-raised p-5 ring-1 ring-line-subtle md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-small font-medium text-fg">Name</span>
              <input className={input} value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-small font-medium text-fg">Mobile number</span>
              <input className={input} type="tel" value={form.mobile} maxLength={20} placeholder="+91 98765 43210" onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-small font-medium text-fg">Email address</span>
              <input className={`${input} disabled:cursor-not-allowed disabled:bg-sunken disabled:text-fg-subtle`} value={account.email} disabled />
              <span className="block mt-1 text-xs text-fg-subtle">Your email comes from your Google sign-in and cannot be changed.</span>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 flex justify-between text-small font-medium text-fg">Bio <span className="tabular font-normal text-caption text-fg-subtle">{form.bio.length}/300</span></span>
              <textarea className={`${input} resize-none`} rows={3} maxLength={300} value={form.bio} placeholder="What are you studying, and what are you aiming for?" onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </label>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setEditing(false); setNotice(null); setForm({ name: account.name || '', mobile: account.mobile || '', bio: account.bio || '' }); }}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} loadingLabel="Saving…">Save changes</Button>
            </div>
          </form>
        ) : (
          <>
            {account.bio
              ? <p className="mt-5 max-w-3xl text-body leading-relaxed text-fg-muted">{account.bio}</p>
              : <p className="mt-5 text-body text-fg-subtle">No bio yet. Add a line about what you are studying.</p>}

            <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-line-subtle py-4 lg:grid-cols-4">
              <Detail label="Email">{account.email}</Detail>
              <Detail label="Mobile">{account.mobile || <span className="text-fg-subtle">Not added</span>}</Detail>
              <Detail label="Member since">{formatDate(account.memberSince)}</Detail>
              <Detail label="Last active">{relative(account.lastActiveAt)}</Detail>
            </dl>
          </>
        )}

        {goal && !editing && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex min-w-0 items-center gap-3">
              <UIIcon name="target" className="h-4 w-4 text-accent-fg" />
              <div className="min-w-0">
                <p className="text-caption text-fg-subtle">Current goal</p>
                <p className="text-body font-medium text-fg">
                  {goal.role}{goal.goal && <span className="font-normal text-fg-muted"> · {goal.goal}</span>}
                </p>
              </div>
            </div>
            {goal.readiness !== null && (
              <span className="tabular rounded-sm bg-accent-soft px-1.5 py-0.5 text-caption font-medium text-accent-fg">{goal.readiness}% role-ready</span>
            )}
            {goal.hoursPerWeek && <span className="text-xs text-fg-subtle">{goal.hoursPerWeek} h/week planned</span>}
            {goal.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {goal.skills.slice(0, 8).map((s) => <span key={s} className="rounded-sm bg-sunken px-1.5 py-0.5 text-caption text-fg-muted ring-1 ring-inset ring-line-subtle">{s}</span>)}
                {goal.skills.length > 8 && <span className="text-xs text-fg-subtle">+{goal.skills.length - 8} more</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProfileHeader;
