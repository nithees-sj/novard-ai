import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { QuizRunner, Spinner } from '../learning/LearningUI';
import PassVerdict from '../quiz/PassVerdict';
import { api, errorMessage } from '../../lib/api';

/**
 * The quiz that completes a Skill Plan day. It is graded on the server:
 * passing (the pass mark or more) completes the day; otherwise the student
 * sees what was wrong and can take a new quiz.
 */
export default function DayQuizDialog({ plan, day, onClose, onResult }) {
  const planId = plan.planId || plan._id;
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = useCallback(async () => {
    setBusy(true);
    setError('');
    setResult(null);
    setAnswers({});
    try {
      setQuiz((await api.post('/api/skill-unlocker/day-quiz', { planId, dayNumber: day.day })).data);
    } catch (e) {
      setError(errorMessage(e, 'The quiz could not be written. Please try again.'));
    } finally {
      setBusy(false);
    }
  }, [planId, day.day]);

  useEffect(() => { start(); }, [start]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const list = quiz.questions.map((_, i) => (answers[i] === undefined ? null : answers[i]));
      const res = (await api.post('/api/skill-unlocker/day-quiz/submit', { planId, dayNumber: day.day, answers: list })).data;
      setResult(res);
      setQuiz((q) => ({ ...q, questions: res.questions }));
      setAnswers(Object.fromEntries(res.answers.map((a, i) => [i, a])));
      onResult(res);
    } catch (e) {
      setError(errorMessage(e, 'Your answers could not be marked. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Day ${day.day} quiz: ${day.topic}`}
      description={`${quiz?.questions.length || 5} questions on today’s topic. Score ${quiz?.passPercent ?? 50}% or more to complete the day.`}
      bodyClassName="p-0"
    >
      {error && <p role="alert" className="mx-6 mt-4 rounded-lg bg-danger-soft px-4 py-2.5 text-small text-danger-fg">{error}</p>}
      {!quiz ? (
        <div className="flex items-center justify-center gap-2 px-6 py-16 text-small text-fg-muted" role="status">
          {busy && <><Spinner className="h-4 w-4" /> Writing questions on {day.topic}…</>}
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto">
          <QuizRunner
            questions={quiz.questions}
            answers={answers}
            onAnswer={(qi, oi) => !result && setAnswers((a) => ({ ...a, [qi]: oi }))}
            onSubmit={submit}
            result={result ? { correct: result.correct, total: result.total } : null}
            onRetry={result?.passed ? onClose : start}
            retryLabel={result?.passed ? 'Back to my plan' : busy ? 'Writing a new quiz…' : 'Try a new quiz'}
            header={result && (
              <PassVerdict
                percentage={result.percentage}
                passPercent={result.passPercent}
                passed={result.passed}
                completedLabel={`Day ${day.day} is complete: ${result.completedDays} of ${plan.duration} days done.`}
                retryHint="The day stays open. Read the explanations below, rewatch the video if it helps, then try a new quiz."
              />
            )}
          />
        </div>
      )}
    </Modal>
  );
}
