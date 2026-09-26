import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { readOpenParam, clearOpenParam } from '../../lib/openParam';
import SkillGapIntake from './SkillGapIntake';
import SkillGapChat from './SkillGapChat';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;
const userId = () => localStorage.getItem('email') || 'demo-user';

const readinessBadge = (r) =>
  r >= 75 ? 'bg-green-100 text-green-800' : r >= 50 ? 'bg-blue-100 text-blue-800' : r >= 25 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700';

/**
 * Skill Gap Analysis as a coaching chat: a short intake, an analysis of what
 * the target role needs versus what the student has, then an open
 * conversation grounded in that analysis. Each analysis is saved per student
 * (the old version cached one shared list per role for everyone).
 */
const SkillGapWorkspace = ({ heightClass = 'h-[calc(100vh-200px)]' }) => {
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
      const { data } = await axios.get(`${apiUrl}/api/skill-gap/sessions/user/${encodeURIComponent(userId())}`);
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading analyses:', err);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const start = async (profile) => {
    setStarting(true);
    setError(null);
    try {
      const { data } = await axios.post(`${apiUrl}/api/skill-gap/sessions`, { ...profile, userId: userId() });
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
      const { data } = await axios.get(`${apiUrl}/api/skill-gap/sessions/${id}`, { params: { userId: userId() } });
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
      const { data } = await axios.post(`${apiUrl}/api/skill-gap/sessions/${session._id}/messages`, { userId: userId(), message: text });
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
      await axios.delete(`${apiUrl}/api/skill-gap/sessions/${session._id}`, { data: { userId: userId() } });
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
    <div className={`flex gap-6 ${heightClass}`}>
      <main className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-gray-50/40 p-6 overflow-hidden">
        {view === 'intake' ? (
          <div className="h-full overflow-y-auto">
            <SkillGapIntake onStart={start} starting={starting} error={error} initial={preset} />
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

      <aside className="w-80 shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden" aria-label="Your analyses">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Your Analyses</h3>
          <button
            type="button"
            onClick={() => newAnalysis()}
            aria-pressed={view === 'intake'}
            className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${view === 'intake'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {view === 'intake' ? 'Starting a new analysis…' : '+ New Analysis'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {list.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8 px-4">Your coaching chats will appear here.</p>
          ) : list.map((s) => {
            const active = view === 'chat' && session?._id === s._id;
            return (
              <button
                key={s._id}
                type="button"
                onClick={() => open(s._id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${active
                  ? 'bg-blue-50 border-blue-200 border-l-4 border-l-blue-600'
                  : 'bg-white border-gray-200 hover:border-gray-300'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold truncate ${active ? 'text-blue-800' : 'text-gray-900'}`}>{s.targetRole}</span>
                  {loadingId === s._id
                    ? <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" aria-hidden="true" />
                    : <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded tabular-nums ${readinessBadge(s.readiness)}`}>{s.readiness}%</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {Math.max(0, s.messageCount - 1)} {s.messageCount - 1 === 1 ? 'message' : 'messages'} · {when(s.updatedAt)}
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
};

export default SkillGapWorkspace;
