import React, { useState } from 'react';
import { QuizRunner, Icon, Spinner } from '../learning/LearningUI';
import Badge from '../ui/Badge';
import PassVerdict from '../quiz/PassVerdict';
import { examsApi, pct, masteryTone } from '../../lib/exams';

/**
 * A practice, review, diagnostic or mock quiz from Exam Autopilot. It is
 * graded on the server; the result shows each topic's score and mastery
 * change, the readiness change and what the re-plan did.
 */
export default function ExamQuiz({ examId, quiz: initial, onGraded, onClose, onRetry, onReport }) {
  const [quiz, setQuiz] = useState(initial);
  const [answers, setAnswers] = useState({});
  const [outcome, setOutcome] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSending(true);
    setError('');
    try {
      const list = quiz.questions.map((_, i) => (answers[i] === undefined ? null : answers[i]));
      const res = await examsApi.submit(examId, quiz._id, list);
      setQuiz(res.quiz);
      setOutcome(res);
      onGraded(res.exam);
    } catch (e) {
      setError(e.message || 'Your answers could not be marked. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const delta = outcome ? Math.round((outcome.readiness.after - outcome.readiness.before) * 100) : 0;
  const gated = ['check', 'practice', 'review'].includes(quiz.kind) && quiz.taskId;
  const header = outcome && (
    <div className="space-y-4 rounded-xl bg-sunken p-4">
      {gated && (
        <PassVerdict
          percentage={Math.round((quiz.correct / Math.max(1, quiz.total)) * 100)}
          passPercent={outcome.passPercent}
          passed={outcome.passed}
          completedLabel={quiz.kind === 'check' ? `${quiz.topics[0]} is completed. Autopilot moves you on to practice.` : 'Task completed.'}
          retryHint="The task stays open: your answers still count towards mastery. Read the explanations, ask the tutor, then try a new quiz."
          className="bg-raised"
        />
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="text-body text-fg">
          Readiness <strong className="tabular font-semibold">{pct(outcome.readiness.before)} → {pct(outcome.readiness.after)}</strong>
          {delta !== 0 && <Badge tone={delta > 0 ? 'success' : 'danger'} className="ml-2">{delta > 0 ? `+${delta}` : delta} pts</Badge>}
        </p>
        <p className="text-body text-fg-muted">Exam-day forecast <strong className="tabular font-semibold text-fg">{pct(outcome.forecast.before)} → {pct(outcome.forecast.after)}</strong></p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {outcome.breakdown.map((b) => (
          <li key={b.topicId} className="flex items-center gap-3 rounded-lg bg-raised px-3 py-2 ring-1 ring-inset ring-line-subtle">
            <span className="min-w-0 flex-1 truncate text-small font-medium text-fg">{b.topic}</span>
            <span className="tabular text-small text-fg-muted">{b.correct}/{b.total}</span>
            <Badge tone={masteryTone(b.masteryAfter)}>{pct(b.masteryBefore)} → {pct(b.masteryAfter)}</Badge>
          </li>
        ))}
      </ul>
      <p className="flex items-start gap-2 text-small text-fg-muted">
        <Icon name="refresh" className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" />
        <span><strong className="font-semibold text-fg">Plan updated: </strong>{outcome.planChange}</span>
      </p>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line-subtle px-6 py-3">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 text-small font-medium text-fg-muted hover:text-fg"><Icon name="arrowLeft" className="h-4 w-4" /> Back to plan</button>
        <span className="text-small text-fg-subtle">·</span>
        <span className="truncate text-small font-medium text-fg">{quiz.label}{quiz.topics.length === 1 ? `: ${quiz.topics[0]}` : ` · ${quiz.topics.length} topics`}</span>
        {sending && <Spinner className="ml-auto h-4 w-4" />}
      </div>
      {error && <p role="alert" className="mx-6 mt-3 rounded-lg bg-danger-soft px-4 py-2.5 text-small text-danger-fg">{error}</p>}
      <div className="min-h-0 flex-1">
        <QuizRunner
          questions={quiz.questions}
          answers={answers}
          onAnswer={(qi, oi) => setAnswers((a) => ({ ...a, [qi]: oi }))}
          onSubmit={submit}
          result={outcome ? { correct: quiz.correct, total: quiz.total } : null}
          onRetry={outcome?.retry && onRetry ? onRetry : onClose}
          retryLabel={outcome?.retry && onRetry ? 'Try a new quiz' : 'Back to my plan'}
          header={header}
          onReport={onReport}
        />
      </div>
    </div>
  );
}
