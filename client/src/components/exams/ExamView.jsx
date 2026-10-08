import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TodayTab from './TodayTab';
import TutorTab from './TutorTab';
import TopicsTab from './TopicsTab';
import ProgressTab from './ProgressTab';
import ExamQuiz from './ExamQuiz';
import PlanSettings from './PlanSettings';
import { ItemFrame, TabBar, TabBody } from '../learning/LearningUI';
import Button from '../ui/Button';
import { useReportProblem } from '../../context/ReportContext';
import { examsApi, dayLabel, lessonRequest } from '../../lib/exams';

const countdown = (n) => (n > 1 ? `${n} days to go` : n === 1 ? 'tomorrow' : n === 0 ? 'today' : 'finished');

/**
 * One exam, in the same frame as every learning tool: a heading bar (the exam,
 * its date, the plan settings) and four tabs - Today, Tutor, Topics, Progress.
 * Quizzes open in place of the tab; studying a topic opens the exam's own
 * tutor, never another page.
 */
export default function ExamView({ exam, onChange, onError }) {
  const navigate = useNavigate();
  const openReport = useReportProblem();
  const [tab, setTab] = useState('today');
  const [quiz, setQuiz] = useState(null);
  const [busyTask, setBusyTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState(() => exam.tutor || []);
  const [sending, setSending] = useState(false);
  const [focusId, setFocusId] = useState(null);

  const run = async (key, fn) => {
    setBusyTask(key);
    try {
      return await fn();
    } catch (e) {
      onError(e.message || 'That did not work. Please try again.');
      return null;
    } finally {
      setBusyTask(null);
    }
  };

  const save = async (patch) => {
    setSaving(true);
    try {
      onChange(await examsApi.update(exam._id, patch));
      return true;
    } catch (e) {
      onError(e.message || 'The plan could not be updated.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── the tutor ──
  const send = async (text, topicId = focusId) => {
    setSending(true);
    setMessages((list) => [...list, { role: 'user', content: text }]);
    try {
      const res = await examsApi.tutor(exam._id, text, topicId);
      setMessages(res.messages);
      return true;
    } catch (e) {
      setMessages((list) => list.slice(0, -1));
      onError(e.message || 'Your tutor could not reply. Please try again.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const studyTopic = (topicId, name) => {
    setQuiz(null);
    setTab('tutor');
    setFocusId(topicId);
    const ask = lessonRequest(name);
    // Opening the same lesson twice should not ask twice.
    if (!sending && [...messages].reverse().find((m) => m.role === 'user')?.content !== ask) send(ask, topicId);
  };

  const clearTutor = async () => {
    try {
      setMessages((await examsApi.clearTutor(exam._id)).messages);
    } catch (e) {
      onError(e.message || 'Could not start a new conversation.');
    }
  };

  // ── the plan ──
  const start = (task) => {
    if (task.type === 'learn') return studyTopic(task.topicId, task.topic);
    if (task.type === 'teach') return navigate(`/teach-back?exam=${exam._id}&topic=${task.topicId}&task=${task._id}`);
    return openTaskQuiz(task);
  };
  const [quizTask, setQuizTask] = useState(null); // the task a quiz is for, to retry it after a fail
  const openTaskQuiz = (task) => run(task._id, async () => {
    setQuizTask({ topicId: task.topicId, type: task.type });
    setQuiz(await examsApi.taskQuiz(exam._id, task._id));
  });
  // After a fail the plan re-plans, so today's open task for the same topic has a new id.
  const retryQuiz = (latest) => {
    const task = quizTask && latest.today.tasks.find((t) => t.status === 'todo' && t.topicId === quizTask.topicId && t.type === quizTask.type);
    if (task) openTaskQuiz(task);
    else setQuiz(null);
  };
  const setStatus = (task, status) => run(task._id, async () => onChange(await examsApi.setTask(exam._id, task._id, status)));
  const diagnostic = () => run('diagnostic', async () => {
    const open = exam.openQuizzes.find((q) => q.kind === 'diagnostic');
    setQuiz(open ? await examsApi.quiz(exam._id, open._id) : await examsApi.mock(exam._id, 'diagnostic'));
  });

  const changeTab = (next) => {
    setQuiz(null);
    setTab(next);
  };

  return (
    <>
      <ItemFrame
        icon="exam"
        title={exam.title}
        meta={`${dayLabel(exam.examDate, { weekday: 'long', day: 'numeric', month: 'long' })} · ${countdown(exam.daysLeft)} · ${exam.dailyMinutes} min a day · target ${exam.targetReadiness}%`}
        actions={<Button size="sm" variant="ghost" icon="sliders" aria-label="Plan settings" onClick={() => setSettingsOpen(true)}><span className="hidden sm:inline">Plan settings</span></Button>}
        tabs={(
          <TabBar
            size="sm"
            label="Exam sections"
            active={quiz ? null : tab}
            onChange={changeTab}
            tabs={[
              { id: 'today', label: 'Today', icon: 'plan' },
              { id: 'tutor', label: 'Tutor', icon: 'chat', busy: sending },
              { id: 'topics', label: 'Topics', icon: 'layers' },
              { id: 'progress', label: 'Progress', icon: 'trend' },
            ]}
          />
        )}
      >
        {quiz ? (
          <TabBody>
            <ExamQuiz
              key={quiz._id}
              examId={exam._id}
              quiz={quiz}
              onGraded={onChange}
              onClose={() => setQuiz(null)}
              onRetry={() => retryQuiz(exam)}
              onReport={(q) => openReport({ area: 'other', source: { tool: 'examAutopilot', excerpt: q.question } })}
            />
          </TabBody>
        ) : (
          <TabBody>
            {tab === 'today' && (
              <TodayTab
                exam={exam}
                busyTask={busyTask}
                saving={saving}
                onStart={start}
                onCheck={openTaskQuiz}
                onStatus={setStatus}
                onApplyMinutes={(minutes) => save({ dailyMinutes: minutes })}
                onDiagnostic={diagnostic}
              />
            )}
            {tab === 'tutor' && (
              <TutorTab
                exam={exam}
                messages={messages}
                sending={sending}
                focusId={focusId}
                onFocus={setFocusId}
                onSend={(text) => send(text)}
                onClear={clearTutor}
                onCheck={openTaskQuiz}
                learnBusy={Boolean(busyTask)}
                onReport={(m) => openReport({ area: 'other', source: { tool: 'examAutopilot', excerpt: m.content } })}
              />
            )}
            {tab === 'topics' && (
              <TopicsTab
                exam={exam}
                onAskTutor={(t) => { setFocusId(t._id); changeTab('tutor'); }}
                onTeachBack={(t) => navigate(`/teach-back?exam=${exam._id}&topic=${t._id}`)}
              />
            )}
            {tab === 'progress' && <ProgressTab exam={exam} />}
          </TabBody>
        )}
      </ItemFrame>
      <PlanSettings exam={exam} open={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={save} saving={saving} />
    </>
  );
}
