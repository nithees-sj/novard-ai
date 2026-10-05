import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { PageHeader, usd } from '../../components/admin/ui';
import MarkdownView from '../../components/MarkdownView';
import { Badge, Icon, ListEmpty, ListItem, SideList, Spinner, btn, formatDate, inputClass } from '../../components/learning/LearningUI';
import { adminDelete, adminGet, adminPost } from '../../lib/adminApi';
import { readAdminStream } from '../../lib/adminStream';
import { errorMessage } from '../../lib/api';

const SUGGESTIONS = [
  'What is at risk right now?',
  'How much have we spent on AI this week?',
  'Are any gateways failing?',
  'Show me the urgent open reports',
];

const CARD_TONE = { proposed: 'amber', running: 'blue', done: 'green', dismissed: 'gray', failed: 'red' };
const CARD_LABEL = { proposed: 'Waiting for you', running: 'Running', done: 'Done', dismissed: 'Declined', failed: 'Failed' };

/** A change the assistant proposed: nothing happens until the admin confirms. */
function ActionCard({ action, conversationId, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const decide = async (decision) => {
    setBusy(true);
    setError(null);
    try {
      const { action: next } = await adminPost(`/api/admin/assistant/conversations/${conversationId}/actions/${action.id}`, { decision });
      onUpdate(next);
    } catch (err) {
      setError(errorMessage(err, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 rounded-xl border border-line bg-raised p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-fg">{action.args?.summary || action.type.replace(/_/g, ' ')}</p>
        <Badge tone={CARD_TONE[action.status]}>{CARD_LABEL[action.status] || action.status}</Badge>
      </div>
      {action.args?.note && <p className="mt-1 text-xs text-fg-muted">Note for students: {action.args.note}</p>}
      {action.result?.note && <p className="mt-1 text-xs text-fg-muted">{action.result.note}</p>}
      {action.result?.route && <Link to={action.result.route} className="mt-1 inline-block text-xs font-semibold text-accent-fg hover:underline">{action.result.label || 'Open'}</Link>}
      {action.error && <p className="mt-1 text-xs text-danger-fg">{action.error}</p>}
      {action.status === 'proposed' && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => decide('confirm')} disabled={busy} className={`${btn.primary} py-1.5`}>{busy ? <Spinner /> : null}Confirm</button>
          <button type="button" onClick={() => decide('dismiss')} disabled={busy} className={`${btn.secondary} py-1.5`}>Decline</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-danger-fg">{error}</p>}
    </div>
  );
}

function Message({ message, conversationId, onCardUpdate }) {
  if (message.role === 'user') {
    return <div className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-md bg-accent px-4 py-2.5 text-body text-white">{message.content}</div></div>;
  }
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden="true"><Icon name="shield" className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        {message.tools?.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {message.tools.map((t, i) => <span key={i} className="rounded-md bg-sunken px-1.5 py-0.5 font-mono text-micro text-fg-muted" title={t.preview}>{t.name}{t.ok === false ? ' (failed)' : ''}</span>)}
          </div>
        )}
        <MarkdownView content={message.content} size="base" />
        {(message.actions || []).map((a) => <ActionCard key={a.id} action={a} conversationId={conversationId} onUpdate={(next) => onCardUpdate(a.id, next)} />)}
        <div className="mt-1 flex flex-wrap gap-2 text-micro text-fg-subtle">
          {message.flags?.forcedTool && <span>looked up after a reminder</span>}
          {message.flags?.refused && <span>only the console can do this</span>}
          {message.flags?.capped && <span>stopped at the cost limit</span>}
          {typeof message.usd === 'number' && message.usd > 0 && <span>{usd(message.usd)}</span>}
        </div>
      </div>
    </div>
  );
}

/** The admin assistant: ask about the live platform; it proposes changes you confirm. */
export default function Assistant() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  const loadChats = useCallback(() => adminGet('/api/admin/assistant/conversations').then((d) => setChats(d.conversations)).catch(() => {}).finally(() => setLoadingChats(false)), []);
  useEffect(() => { loadChats(); }, [loadChats]);
  useEffect(() => {
    setError(null);
    if (!id) { setMessages([]); return; }
    adminGet(`/api/admin/assistant/conversations/${id}`).then((d) => setMessages(d.messages || [])).catch((e) => setError(errorMessage(e, 'This chat could not be opened.')));
  }, [id]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }); }, [messages.length, status]);

  const send = async (text = draft) => {
    const message = text.trim();
    if (!message || sending) return;
    setDraft('');
    setSending(true);
    setError(null);
    setMessages((list) => [...list, { role: 'user', content: message }]);
    let conversationId = id;
    try {
      await readAdminStream('/api/admin/assistant/chat', {
        meta: (m) => { conversationId = m.conversationId; },
        status: (s) => setStatus(s.text),
        tool: (t) => setStatus(`Looking up ${t.name.replace(/_/g, ' ')}…`),
        done: (d) => setMessages((list) => [...list, d.message]),
        error: (e) => setError(e.error),
      }, { method: 'POST', body: { message, conversationId: id } });
      if (conversationId && conversationId !== id) navigate(`/admin/assistant/${conversationId}`, { replace: true });
      loadChats();
    } catch (err) {
      setError(err.message || 'The assistant could not reply.');
    } finally {
      setSending(false);
      setStatus('');
    }
  };

  const updateCard = (actionId, next) => setMessages((list) => list.map((m) => (!m.actions ? m : { ...m, actions: m.actions.map((a) => (a.id === actionId ? next : a)) })));
  const remove = async (chatId) => {
    await adminDelete(`/api/admin/assistant/conversations/${chatId}`).catch(() => {});
    if (chatId === id) navigate('/admin/assistant');
    loadChats();
  };

  return (
    <AdminLayout title="ADMIN · ASSISTANT">
      <PageHeader title="Admin assistant" subtitle="Ask about risk, reports, costs, gateways and users. Changes are proposed as cards; nothing happens until you confirm." />
      <div className="flex h-[calc(100vh-230px)] min-h-[520px] flex-col gap-5 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-raised">
          <div className="flex-1 overflow-y-auto" aria-live="polite">
            {!messages.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-base font-semibold text-fg">What would you like to know?</p>
                <div className="flex max-w-lg flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line px-3.5 py-1.5 text-sm text-fg-muted hover:border-accent/50 hover:bg-accent-soft">{s}</button>)}
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
                {messages.map((m, i) => <Message key={`${m.createdAt || 'p'}-${i}`} message={m} conversationId={id} onCardUpdate={updateCard} />)}
                {sending && <p className="flex items-center gap-2 text-sm text-fg-subtle" role="status"><Spinner className="h-4 w-4 text-accent-fg" />{status || 'Thinking…'}</p>}
                <div ref={endRef} />
              </div>
            )}
          </div>
          {error && <p role="alert" className="mx-4 mb-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-fg">{error}</p>}
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-line-subtle p-3">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask the assistant…" aria-label="Message" className={`${inputClass} flex-1`} disabled={sending} />
            <button type="submit" disabled={sending || !draft.trim()} className={btn.primary}><Icon name="send" /></button>
          </form>
        </div>
        <SideList title="Chats" count={chats.length} loading={loadingChats} className="h-64 w-full lg:h-auto lg:w-72" action={<button type="button" onClick={() => navigate('/admin/assistant')} className={`${btn.secondary} w-full py-2`}><Icon name="plus" /> New chat</button>}>
          {chats.length === 0 ? <ListEmpty icon="chat" title="No chats yet" /> : chats.map((c) => (
            <ListItem key={c._id} active={c._id === id} title={c.title} meta={formatDate(c.updatedAt)} onSelect={() => navigate(`/admin/assistant/${c._id}`)} onDelete={() => remove(c._id)} deleteLabel={`Delete ${c.title}`} />
          ))}
        </SideList>
      </div>
    </AdminLayout>
  );
}
