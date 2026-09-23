import React from 'react';

const LEVEL = {
  Expert: { bar: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
  Advanced: { bar: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  Intermediate: { bar: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700' },
  Beginner: { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
  'Not enough data': { bar: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' },
};

const TopicRow = ({ topic }) => {
  const style = LEVEL[topic.level] || LEVEL['Not enough data'];
  return (
    <li>
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate" title={topic.name}>{topic.name}</p>
          <p className="text-xs text-gray-500">
            {topic.domain} · {topic.questions} questions · {topic.attempts} {topic.attempts === 1 ? 'quiz' : 'quizzes'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${style.badge}`}>{topic.level}</span>
          <span className="w-10 text-right text-sm font-bold text-gray-900 tabular-nums">{topic.percentage}%</span>
        </div>
      </div>
      <div
        className="w-full bg-gray-100 rounded-full h-2"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={topic.percentage}
        aria-label={`${topic.name} accuracy`}
      >
        <div className={`h-2 rounded-full transition-all duration-500 ${style.bar}`} style={{ width: `${topic.percentage}%` }} />
      </div>
    </li>
  );
};

const Section = ({ title, hint, topics, empty }) => (
  <section>
    <div className="flex items-baseline justify-between mb-3">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      <span className="text-xs text-gray-400">{hint}</span>
    </div>
    {topics.length > 0 ? (
      <ul className="space-y-4">{topics.map((t) => <TopicRow key={`${t.domain}-${t.name}`} topic={t} />)}</ul>
    ) : (
      <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">{empty}</p>
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
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-gray-900">Strengths & Weaknesses</h3>
        <p className="text-sm text-gray-500">
          Quiz accuracy per topic · {assessed} {assessed === 1 ? 'topic' : 'topics'} assessed
          {pending > 0 && ` · ${pending} need more questions`}
        </p>
      </div>

      {assessed === 0 ? (
        <div className="flex-1 min-h-[200px] flex items-center justify-center rounded-lg bg-gray-50 px-6 text-center text-sm text-gray-500">
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
