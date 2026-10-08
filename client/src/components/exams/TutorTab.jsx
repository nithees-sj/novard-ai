import React from 'react';
import { ChatPanel, Icon } from '../learning/LearningUI';
import { Select } from '../ui/Field';
import Button from '../ui/Button';
import { lessonRequest } from '../../lib/exams';

/**
 * The exam's own tutor, inside Exam Autopilot. It knows the syllabus, the
 * mastery of every topic and today's plan, and teaches from the student's
 * material. Focusing a topic (or opening it from a "learn" task) keeps the
 * conversation on that topic.
 */
export default function TutorTab({ exam, messages, sending, focusId, onFocus, onSend, onClear, onCheck, onReport, learnBusy }) {
  const focus = exam.topics.find((t) => t._id === focusId) || null;
  const weakest = [...exam.topics].filter((t) => t.weight > 0).sort((a, b) => a.mastery - b.mastery || b.weight - a.weight)[0];
  const learnTask = focus && exam.today.tasks.find((t) => t.type === 'learn' && t.status === 'todo' && t.topicId === focus._id);

  const suggestions = focus
    ? [`Give me an exam-style question on ${focus.name}`, `What are the common mistakes in ${focus.name}?`, `Summarise ${focus.name} in five points`]
    : ['What should I focus on today?', weakest && `Quiz me on ${weakest.name}`, 'Why is my plan set up like this?'].filter(Boolean);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line-subtle px-5 py-2.5">
        <label htmlFor="tutor-focus" className="shrink-0 text-small text-fg-muted">Focus</label>
        <Select id="tutor-focus" size="sm" className="min-w-0 flex-1 sm:w-auto sm:max-w-[15rem] sm:flex-none" value={focusId || ''} onChange={(e) => onFocus(e.target.value || null)}>
          <option value="">The whole exam</option>
          {exam.topics.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </Select>
        <span className="hidden min-w-0 flex-1 truncate text-caption text-fg-subtle lg:block">Knows your syllabus, your mastery on every topic and today’s plan.</span>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" icon="refresh" className="ml-auto shrink-0" onClick={onClear} disabled={sending}>New conversation</Button>
        )}
      </div>

      {learnTask && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line-subtle bg-accent-soft/40 px-5 py-2.5">
          <Icon name="book" className="h-4 w-4 text-accent-fg" />
          <p className="flex-1 text-small text-fg">Today’s task: learn <strong className="font-semibold">{focus.name}</strong>. When you’re ready, pass the 5-question check ({exam.passPercent ?? 50}% or more) to complete it.</p>
          <Button size="sm" variant="secondary" icon="quiz" loading={learnBusy} loadingLabel="Writing it…" onClick={() => onCheck(learnTask)}>Take the check</Button>
        </div>
      )}

      <ChatPanel
        messages={messages}
        sending={sending}
        onSend={onSend}
        onReport={onReport}
        placeholder={focus ? `Ask about ${focus.name}…` : `Ask your ${exam.title} tutor…`}
        emptyTitle={focus ? `Study ${focus.name}` : 'Your exam tutor'}
        emptyText={focus
          ? `${focus.summary || ''} Your tutor teaches it for this exam, from your own material, and checks you’ve understood.`.trim()
          : `Ask anything about ${exam.title}: a topic you’re stuck on, an exam-style question, or what to do next. It knows your plan and how you’re doing on every topic.`}
        startPrompt={focus ? { label: `Teach me ${focus.name}`, text: lessonRequest(focus.name) } : weakest ? { label: `Teach me my weakest topic: ${weakest.name}`, text: lessonRequest(weakest.name) } : null}
        suggestions={suggestions}
      />
    </div>
  );
}
