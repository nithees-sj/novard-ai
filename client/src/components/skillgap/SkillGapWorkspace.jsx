import React, { useCallback, useEffect, useState } from 'react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import cx from '../ui/cx';
import { api } from '../../lib/api';
import logger from '../../lib/logger';
import { currentEmail } from '../../lib/session';
import { readOpenParam, clearOpenParam } from '../../lib/openParam';
import SkillGapIntake from './SkillGapIntake';
import SkillGapChat from './SkillGapChat';

const userId = () => currentEmail();

const readinessTone = (r) => (r >= 75 ? 'success' : r >= 50 ? 'accent' : r >= 25 ? 'warning' : 'danger');

/**
 * Skill Gap Analysis as a coaching chat: a short intake, an analysis of what
 * the target role needs versus what the student has, then an open
 * conversation grounded in that analysis. Each analysis is saved per student
 * (the old version cached one shared list per role for everyone).
 */
const SkillGapWorkspace = ({ heightClass = '' }) => {
  const [list, setList] = useState([]);
  const [session, setSession] = useState(null);
  const [view, setView] = useState('intake'); // intake | chat
  const [preset, setPreset] = useState(null);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);

  const loadList = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/skill-gap/sessions/user/${encodeURIComponent(userId())}`);
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.error('Error loading analyses', err);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const start = async (profile) => {
    setStarting(true);
    setError(null);
    try {
      const { data } = await api.post(`/api/skill-gap/sessions`, { ...profile, userId: userId() });
      setSession(data);
      setView('chat');
      setPreset(null);
      loadList();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not analyse your skills. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const open = async (id) => {
    setLoadingId(id);
    setError(null);
    try {
      const { data } = await api.get(`/api/skill-gap/sessions/${id}`, { params: { userId: userId() } });
      setSession(data);
      setView('chat');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not open that analysis.');
    } finally {
      setLoadingId(null);
    }
  };

  // Show the message immediately; if the coach fails, take it back out and report why.
  const send = async (text) => {
    if (!session) return false;
    const optimistic = { role: 'user', content: text, createdAt: new Date().toISOString(), pending: true };
    setSession((s) => ({ ...s, messages: [...s.messages, optimistic] }));
    setSending(true);
    setError(null);
    try {
      const { data } = await api.post(`/api/skill-gap/sessions/${session._id}/messages`, { userId: userId(), message: text });
      setSession((s) => ({ ...s, messages: [...s.messages.filter((m) => m !== optimistic), data.userMessage, data.assistantMessage] }));
      loadList();
      return true;
    } catch (err) {
      setSession((s) => ({ ...s, messages: s.messages.filter((m) => m !== optimistic) }));
      setError(err.response?.data?.error || 'The coach could not reply. Please try again.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const remove = async () => {
    if (!session) return;
    setDeleting(true);
    try {
      await api.delete(`/api/skill-gap/sessions/${session._id}`, { data: { userId: userId() } });
      setSession(null);
      setView('intake');
      loadList();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete the analysis.');
    } finally {
      setDeleting(false);
    }
  };

  // Opened from the Novard Agent's "Open analysis" link.
  useEffect(() => {
    const id = readOpenParam();
    if (id) {
      open(id);
      clearOpenParam();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const newAnalysis = (values = null) => {
    setPreset(values);
    setError(null);
    setView('intake');
  };

  const updateSkills = () => {
    if (!session) return;
    const p = session.profile;
    newAnalysis({ targetRole: p.targetRole, currentSkills: p.currentSkills || [], experience: p.experience, goal: p.goal || '', hoursPerWeek: p.hoursPerWeek || 10 });
  };

  const when = (d) => {
    const date = new Date(d);
    const today = new Date();
    return date.toDateString() === today.toDateString()
      ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  return (
    <div className={cx('flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-0 md:overflow-hidden md:rounded-xl md:bg-raised md:ring-1 md:ring-line-subtle', heightClass)}>
      <aside className="flex max-h-[24rem] shrink-0 flex-col overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle md:max-h-none md:w-72 md:rounded-none md:border-r md:border-line-subtle md:bg-canvas/60 md:ring-0" aria-label="Your analyses">
        <div className="px-4 pb-3 pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-body font-semibold text-fg">Your analyses</h3>
            {list.length > 0 && <span className="tabular text-caption text-fg-subtle">{list.length}</span>}
          </div>
          <Button
            onClick={() => newAnalysis()}
            aria-pressed={view === 'intake'}
            variant={view === 'intake' ? 'secondary' : 'primary'}
            icon={view === 'intake' ? undefined : 'plus'}
            disabled={view === 'intake'}
            block
          >
            {view === 'intake' ? 'Starting a new analysis…' : 'New analysis'}
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {list.length === 0 ? (
            <p className="px-4 py-8 text-center text-small text-fg-subtle">Your coaching chats are kept here.</p>
          ) : list.map((s) => {
            const active = view === 'chat' && session?._id === s._id;
            return (
              <button
                key={s._id}
                type="button"
                onClick={() => open(s._id)}
                aria-current={active ? 'true' : undefined}
                className={cx(
                  'w-full rounded-lg px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                  active ? 'bg-accent-soft' : 'hover:bg-sunken',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cx('truncate text-body font-medium', active ? 'text-accent-fg' : 'text-fg')}>{s.targetRole}</span>
                  {loadingId === s._id
                    ? <Spinner className="h-3.5 w-3.5 text-accent-fg" />
                    : <Badge tone={readinessTone(s.readiness)} className="tabular">{s.readiness}%</Badge>}
                </div>
                <div className="mt-0.5 text-caption text-fg-subtle">
                  {Math.max(0, s.messageCount - 1)} {s.messageCount - 1 === 1 ? 'message' : 'messages'} · {when(s.updatedAt)}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="flex min-h-[28rem] min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle md:min-h-0 md:rounded-none md:ring-0">
        {view === 'intake' ? (
          <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
              <SkillGapIntake onStart={start} starting={starting} error={error} initial={preset} />
            </div>
          </div>
        ) : session && (
          <SkillGapChat
            session={session}
            onSend={send}
            sending={sending}
            error={error}
            onUpdateSkills={updateSkills}
            onDelete={remove}
            deleting={deleting}
          />
        )}
      </main>
    </div>
  );
};

export default SkillGapWorkspace;
