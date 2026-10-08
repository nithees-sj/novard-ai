import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import FeatureNotice from '../components/FeatureNotice';
import SetupForm from '../components/teachback/SetupForm';
import Arena from '../components/teachback/Arena';
import Results from '../components/teachback/Results';
import {
  Workspace, ItemFrame, TabBody, TabBar, ChatPanel, GeneratingState, EmptyState, LoadingPanel,
  SideList, ListItem, ListEmpty, Badge, Toast, Icon, btn, formatDate, useToastTimer,
} from '../components/learning/LearningUI';
import confirm from '../components/ui/confirm';
import { useFeature } from '../context/AppStatusContext';
import { useReportProblem } from '../context/ReportContext';
import { readParam, clearParam } from '../lib/openParam';
import { teachBackApi, scoreTone } from '../lib/teachBack';

const OPENING_REQUEST = 'Teach me my weak spots so I get stronger.';
const COACH_SUGGESTIONS = ['Explain the step I got wrong', 'Give me a real-life example', 'Quiz me with one question'];

/** A session in the list: its concept, where it came from and its marks. */
const listSummary = (s) => ({
  _id: s._id,
  concept: s.concept,
  source: s.source,
  status: s.status,
  score: s.status === 'graded' ? s.result?.score ?? s.score ?? null : null,
  previousScore: s.previousScore,
  createdAt: s.createdAt,
});

/**
 * Teach-Back Arena: teach a concept to Novard (talking or typing), get marks
 * as a flow of the concept that shows where you lag, then let Novard teach
 * you the weak steps and try again.
 */
export default function TeachBack() {
  const feature = useFeature('teachBack');
  const openReport = useReportProblem();
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(null);
  const [creating, setCreating] = useState(() => !readParam('open'));
  const [prefill, setPrefill] = useState(() => (readParam('note') ? { noteId: readParam('note') } : null));
  const [tab, setTab] = useState('teach');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [coaching, setCoaching] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = useToastTimer(setToast);

  useEffect(() => {
    teachBackApi.voice().then((v) => setVoiceEnabled(Boolean(v.enabled))).catch(() => setVoiceEnabled(false));
  }, []);

  const open = useCallback(async (id, nextTab) => {
    try {
      const session = await teachBackApi.get(id);
      setCurrent(session);
      setCreating(false);
      setReady(false);
      setTab(nextTab || (session.status === 'graded' ? 'marks' : 'teach'));
    } catch (error) {
      showToast(error.message || 'Could not open that session.');
    }
  }, [showToast]);

  useEffect(() => {
    const openId = readParam('open');
    // From an Exam Autopilot task: start a session on that topic straight away.
    const examRef = readParam('exam') && readParam('topic')
      ? { examId: readParam('exam'), topicId: readParam('topic'), taskId: readParam('task') || undefined }
      : null;
    ['open', 'note', 'exam', 'topic', 'task'].forEach(clearParam);
    teachBackApi.list()
      .then((list) => {
        setSessions(list);
        if (examRef) startRef.current({ examRef });
        else if (openId) open(openId);
        else if (!list.length) setCreating(true);
      })
      .catch((error) => showToast(error.message || 'Could not load your sessions.'))
      .finally(() => setLoaded(true));
  }, [open, showToast]);

  const startRef = useRef(null);

  const replace = (session) => {
    setCurrent(session);
    setSessions((list) => {
      const row = listSummary(session);
      return list.some((s) => s._id === session._id) ? list.map((s) => (s._id === session._id ? row : s)) : [row, ...list];
    });
  };

  const start = async (input) => {
    setStarting(true);
    setStartError('');
    try {
      const session = await teachBackApi.start(input);
      replace(session);
      setCreating(false);
      setPrefill(null);
      setReady(false);
      setTab('teach');
    } catch (error) {
      setStartError(error.message || 'Could not start. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  startRef.current = start;

  const explain = async (input) => {
    setSending(true);
    try {
      const { ready: isReady, ...session } = await teachBackApi.explain(current._id, input);
      replace(session);
      setReady(Boolean(isReady) || session.followUpsLeft === 0);
      return true;
    } catch (error) {
      showToast(error.message || 'That could not be sent. Please try again.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const finish = async () => {
    setFinishing(true);
    setTab('marks');
    try {
      replace(await teachBackApi.finish(current._id));
    } catch (error) {
      setTab('teach');
      showToast(error.message || 'Your marks could not be worked out. Please try again.');
    } finally {
      setFinishing(false);
    }
  };

  const coach = async (text) => {
    const id = current._id;
    setCoaching(true);
    setCurrent((s) => ({ ...s, coaching: [...s.coaching, { role: 'user', content: text }] }));
    try {
      const { session } = await teachBackApi.coach(id, text);
      replace(session);
      return true;
    } catch (error) {
      setCurrent((s) => (s._id === id ? { ...s, coaching: s.coaching.slice(0, -1) } : s));
      showToast(error.message || 'Novard could not reply. Please try again.');
      return false;
    } finally {
      setCoaching(false);
    }
  };

  // "Teach me my weak spots" from the marks: open the tab and ask, unless the lesson is already there.
  const startCoaching = () => {
    setTab('coach');
    if (!current.coaching.length && !coaching) coach(OPENING_REQUEST);
  };

  const teachAgain = () => {
    setPrefill({ concept: current.concept, focus: current.focus, noteId: current.source?.noteId || '' });
    setStartError('');
    // Still counts for the exam topic it came from (but not for the task, which is done).
    const examRef = current.examRef ? { examId: current.examRef.examId, topicId: current.examRef.topicId } : undefined;
    if (current.source?.noteId) {
      start({ concept: current.concept, focus: current.focus, noteId: current.source.noteId, examRef });
    } else {
      start({ concept: current.concept, focus: current.focus, examRef });
    }
  };

  const remove = async (s) => {
    if (!(await confirm({ title: 'Delete this session?', message: `“${s.concept}” and its marks will be deleted.`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await teachBackApi.remove(s._id);
      setSessions((list) => list.filter((x) => x._id !== s._id));
      if (current?._id === s._id) { setCurrent(null); setCreating(true); }
      showToast('Session deleted.', 'success');
    } catch (error) {
      showToast(error.message || 'Could not delete it.');
    }
  };

  const report = () => openReport({ area: 'other', source: { tool: 'teachBack', excerpt: `Teach-Back marks for "${current.concept}": ${current.result?.score}/100. ${current.result?.verdict || ''}` } });
  const reportCoach = (m) => openReport({ area: 'other', source: { tool: 'teachBack', excerpt: m.content } });

  const graded = current?.status === 'graded';

  return (
    <AppShell page="teachBack" width="full" title={current && !creating ? `${current.concept} · Teach-Back` : undefined}>
      <FeatureNotice tool="teachBack" className="mb-4" />
      <Workspace
        side={(
          <SideList
            loading={!loaded}
            title="Your teach-backs"
            count={sessions.length}
            action={(
              <button
                type="button"
                onClick={() => { setCreating(true); setPrefill(null); setStartError(''); }}
                aria-pressed={creating}
                disabled={!feature.enabled}
                className={`${creating ? btn.secondary : btn.primary} w-full`}
              >
                <Icon name="plus" /> {creating ? 'Choosing what to teach…' : 'Teach something new'}
              </button>
            )}
          >
            {sessions.length > 0 ? sessions.map((s) => (
              <ListItem
                key={s._id}
                active={current?._id === s._id && !creating}
                title={s.concept}
                subtitle={s.source?.kind === 'pdf' ? s.source.label : null}
                meta={formatDate(s.createdAt)}
                badges={s.score !== null && s.score !== undefined
                  ? <Badge tone={scoreTone(s.score) === 'accent' ? 'info' : scoreTone(s.score)}>{s.score}/100</Badge>
                  : <Badge tone="neutral">In progress</Badge>}
                onSelect={() => open(s._id)}
                onDelete={() => remove(s)}
              />
            )) : <ListEmpty icon="teach" title="Nothing taught yet" text="Pick a PDF or a concept and explain it to Novard." />}
          </SideList>
        )}
      >
        {creating || (!current && loaded) ? (
          <SetupForm
            key={JSON.stringify(prefill)}
            initial={prefill}
            onStart={start}
            onCancel={current ? () => setCreating(false) : undefined}
            submitting={starting}
            error={startError}
          />
        ) : !current ? (
          <LoadingPanel label="Loading your session…" />
        ) : (
          <ItemFrame
            icon="teach"
            title={current.concept}
            actions={current.examRef && (
              <Link to={`/exams?open=${current.examRef.examId}`} className={btn.ghost} title="This session counts towards your Exam Autopilot plan">
                <Icon name="exam" /> Back to my plan
              </Link>
            )}
            meta={[
              current.examRef ? 'Exam Autopilot' : null,
              current.source?.kind === 'pdf' ? `From ${current.source.label}` : 'Concept',
              current.focus ? `Focus: ${current.focus}` : null,
              graded ? `${current.result.score}/100` : 'Teaching',
            ].filter(Boolean).join(' · ')}
            tabs={(
              <TabBar
                size="sm"
                active={tab}
                onChange={setTab}
                tabs={[
                  { id: 'teach', label: 'Teach', icon: 'mic', busy: sending },
                  { id: 'marks', label: 'Marks & flow', icon: 'flow', busy: finishing },
                  { id: 'coach', label: 'Teach me', icon: 'graduation', busy: coaching },
                ]}
              />
            )}
          >
            {tab === 'teach' && (
              <Arena
                session={current}
                voiceEnabled={voiceEnabled}
                sending={sending}
                finishing={finishing}
                ready={ready}
                onExplain={explain}
                onFinish={finish}
                onShowMarks={() => setTab('marks')}
              />
            )}

            {tab === 'marks' && (
              <TabBody>
                {finishing ? (
                  <GeneratingState icon="flow" title="Marking your explanation" hint="Breaking the concept into its steps and checking what you explained, missed or got wrong. This usually takes 10-30 seconds." />
                ) : graded ? (
                  <Results session={current} onCoach={startCoaching} onRetry={teachAgain} onReport={report} />
                ) : (
                  <EmptyState
                    icon="flow"
                    title="No marks yet"
                    text={current.canFinish ? 'You have explained something. Get your marks to see the flow of the concept and where you are lagging.' : 'Explain the concept in the Teach tab first.'}
                    action={current.canFinish
                      ? <button type="button" className={btn.primary} onClick={finish}><Icon name="award" /> Finish &amp; get marks</button>
                      : <button type="button" className={btn.secondary} onClick={() => setTab('teach')}>Go to Teach</button>}
                  />
                )}
              </TabBody>
            )}

            {tab === 'coach' && (
              graded ? (
                <ChatPanel
                  messages={current.coaching}
                  sending={coaching}
                  onSend={coach}
                  onReport={reportCoach}
                  placeholder="Ask Novard to explain a step, give an example, or check your answer…"
                  emptyTitle="Get stronger on what you missed"
                  emptyText={`Novard teaches the steps of “${current.concept}” you lagged on, with examples and quick checks.`}
                  startPrompt={{ label: 'Teach me my weak spots', text: OPENING_REQUEST }}
                  suggestions={COACH_SUGGESTIONS}
                />
              ) : (
                <TabBody>
                  <EmptyState icon="graduation" title="Get your marks first" text="Once your explanation is marked, Novard teaches you exactly the steps you lagged on." />
                </TabBody>
              )
            )}

            {tab === 'coach' && graded && current.coaching.length > 1 && !coaching && (
              <div className="border-t border-line-subtle px-6 py-3">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
                  <p className="text-small text-fg-muted">Feeling stronger? Explain it again and watch your score change.</p>
                  <button type="button" className={btn.primary} onClick={teachAgain} disabled={starting}><Icon name="refresh" /> Teach it back again</button>
                </div>
              </div>
            )}
          </ItemFrame>
        )}
      </Workspace>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}
