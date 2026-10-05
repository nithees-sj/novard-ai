import React from 'react';
import Badge from '../ui/Badge';
import { BAR, toneForLevel } from '../../lib/levels';


const TopicRow = ({ topic }) => {
  const tone = toneForLevel(topic.level);
  return (
    <li>
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <p className="truncate text-body font-medium text-fg" title={topic.name}>{topic.name}</p>
          <p className="text-caption text-fg-subtle">
            {topic.domain} · {topic.questions} questions · {topic.attempts} {topic.attempts === 1 ? 'quiz' : 'quizzes'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge tone={tone}>{topic.level}</Badge>
          <span className="num w-10 text-right text-small font-medium text-fg">{topic.percentage}%</span>
        </div>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-chart-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={topic.percentage}
        aria-label={`${topic.name} accuracy`}
      >
        <div className={`h-1.5 rounded-full transition-all duration-500 ${BAR[tone]}`} style={{ width: `${topic.percentage}%` }} />
      </div>
    </li>
  );
};

const Section = ({ title, hint, topics, empty }) => (
  <section>
    <div className="flex items-baseline justify-between mb-3">
      <h4 className="text-small font-medium text-fg-muted">{title}</h4>
      <span className="text-caption text-fg-subtle">{hint}</span>
    </div>
    {topics.length > 0 ? (
      <ul className="space-y-4">{topics.map((t) => <TopicRow key={`${t.domain}-${t.name}`} topic={t} />)}</ul>
    ) : (
      <p className="text-small text-fg-subtle">{empty}</p>
    )}
  </section>
);

/**
 * Per-topic quiz accuracy, split at 70%: what the student has mastered and
 * where to practise next. The previous version only ever listed three
 * "strengths", renamed to fixed labels, with random percentages - so it could
 * never show a weakness. A topic appears once it has at least 5 answered
 * questions, so a single lucky guess does not count as mastery.
 */
const StrengthsWeaknesses = ({ data }) => {
  const strengths = data?.strengths || [];
  const focusAreas = data?.focusAreas || [];
  const assessed = data?.assessedTopics || 0;
  const pending = data?.pendingTopics || 0;

  return (
    <div className="flex flex-col rounded-xl bg-raised p-5 ring-1 ring-line-subtle">
      <div className="mb-5">
        <h3 className="text-body font-semibold text-fg">Strengths and weak spots</h3>
        <p className="mt-0.5 text-small text-fg-subtle">
          Quiz accuracy per topic · {assessed} {assessed === 1 ? 'topic' : 'topics'} assessed
          {pending > 0 && ` · ${pending} need more questions`}
        </p>
      </div>

      {assessed === 0 ? (
        <div className="flex-1 min-h-[8rem] flex items-center justify-center px-6 text-center text-body text-fg-subtle">
          {pending > 0
            ? 'Answer a few more quiz questions on a topic (at least 5) to see your strengths and weaknesses.'
            : 'Take a quiz on your notes, videos, doubts or learning plan to see your strengths and weaknesses.'}
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Strengths" hint="70% and above" topics={strengths} empty="No topic above 70% yet - keep practising." />
          <Section title="Needs practice" hint="below 70%" topics={focusAreas} empty="Nothing below 70% - great work." />
        </div>
      )}
    </div>
  );
};

export default StrengthsWeaknesses;
