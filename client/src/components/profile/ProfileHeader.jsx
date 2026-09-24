import React, { useEffect, useState } from 'react';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;

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

const Detail = ({ icon, label, children }) => (
  <div className="flex items-start gap-3 min-w-0">
    <span className="w-9 h-9 shrink-0 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500" aria-hidden="true">{icon}</span>
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 truncate">{children}</dd>
    </div>
  </div>
);

const Icon = ({ d }) => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>
);
const ICONS = {
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
};

/**
 * Identity card at the top of the profile: photo, name, contact details, bio
 * and the student's current goal. "Edit profile" swaps the details for a form.
 */
const ProfileHeader = ({ account, goal, fallbackPicture, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setForm({ name: account.name || '', mobile: account.mobile || '', bio: account.bio || '' });
  }, [account.name, account.mobile, account.bio]);

  const picture = account.picture || fallbackPicture || '/img/team/user.jpeg';
  const initials = (account.name || account.email || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const save = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const mobile = form.mobile.trim();
    if (!name) return setNotice({ type: 'error', text: 'Please enter your name.' });
    if (mobile && !/^\+?[\d\s()-]{7,20}$/.test(mobile)) return setNotice({ type: 'error', text: 'Please enter a valid phone number.' });
    setSaving(true);
    setNotice(null);
    try {
      const { data } = await axios.post(`${apiUrl}/updateUserProfile`, { email: account.email, name, mobile, bio: form.bio.trim() });
      if (!data.success) throw new Error('not saved');
      localStorage.setItem('name', name);
      onSaved?.({ name, mobile, bio: form.bio.trim() });
      setEditing(false);
      setNotice({ type: 'success', text: 'Profile updated.' });
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.error || 'Could not save your profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500';

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden" aria-label="Your details">
      <div className="h-28 bg-gradient-to-r from-primary-700 via-primary-600 to-primary-400 relative">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_85%_20%,white_0,transparent_45%)]" aria-hidden="true" />
      </div>

      <div className="px-8 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-5 min-w-0">
            <div className="relative shrink-0 -mt-12">
              <img
                src={picture}
                alt=""
                referrerPolicy="no-referrer"
                className="w-24 h-24 rounded-2xl border-4 border-white shadow-md object-cover bg-primary-100"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
              />
              <span className="hidden w-24 h-24 rounded-2xl border-4 border-white shadow-md bg-primary-600 text-white text-2xl font-bold items-center justify-center" aria-hidden="true">{initials}</span>
            </div>
            <div className="min-w-0 pb-1">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{account.name || 'Your profile'}</h1>
              <p className="text-sm text-gray-500 truncate">{account.email}</p>
            </div>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => { setEditing(true); setNotice(null); }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              Edit profile
            </button>
          )}
        </div>

        {notice && (
          <p role={notice.type === 'error' ? 'alert' : 'status'} className={`mt-5 text-sm rounded-lg px-4 py-2.5 border ${notice.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
            {notice.text}
          </p>
        )}

        {editing ? (
          <form onSubmit={save} className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Name</span>
              <input className={input} value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Mobile number</span>
              <input className={input} type="tel" value={form.mobile} maxLength={20} placeholder="+91 98765 43210" onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Email address</span>
              <input className={`${input} bg-gray-100 text-gray-500 cursor-not-allowed`} value={account.email} disabled />
              <span className="block mt-1 text-xs text-gray-500">Your email comes from your Google sign-in and cannot be changed.</span>
            </label>
            <label className="block md:col-span-2">
              <span className="flex justify-between text-sm font-medium text-gray-700 mb-1.5">Bio <span className="font-normal text-xs text-gray-400">{form.bio.length}/300</span></span>
              <textarea className={`${input} resize-none`} rows={3} maxLength={300} value={form.bio} placeholder="What are you studying, and what are you aiming for?" onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </label>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => { setEditing(false); setNotice(null); setForm({ name: account.name || '', mobile: account.mobile || '', bio: account.bio || '' }); }} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {account.bio
              ? <p className="mt-5 text-sm text-gray-700 leading-relaxed max-w-3xl">{account.bio}</p>
              : <p className="mt-5 text-sm text-gray-400 italic">No bio yet. Add a line about what you are studying.</p>}

            <dl className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <Detail icon={<Icon d={ICONS.mail} />} label="Email">{account.email}</Detail>
              <Detail icon={<Icon d={ICONS.phone} />} label="Mobile">{account.mobile || <span className="text-gray-400 font-normal">Not added</span>}</Detail>
              <Detail icon={<Icon d={ICONS.calendar} />} label="Member since">{formatDate(account.memberSince)}</Detail>
              <Detail icon={<Icon d={ICONS.clock} />} label="Last active">{relative(account.lastActiveAt)}</Detail>
            </dl>
          </>
        )}

        {goal && !editing && (
          <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center" aria-hidden="true">🎯</span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Current goal</p>
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {goal.role}{goal.goal && <span className="font-normal text-gray-600"> · {goal.goal}</span>}
                </p>
              </div>
            </div>
            {goal.readiness !== null && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-800 border border-primary-100">{goal.readiness}% role-ready</span>
            )}
            {goal.hoursPerWeek && <span className="text-xs text-gray-500">{goal.hoursPerWeek} h/week planned</span>}
            {goal.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {goal.skills.slice(0, 8).map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">{s}</span>)}
                {goal.skills.length > 8 && <span className="text-xs text-gray-400">+{goal.skills.length - 8} more</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProfileHeader;
