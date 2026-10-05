import React, { useState } from 'react';

/**
 * The agent's questions with tap-to-answer options. The answers go back as
 * one ordinary chat message ("Where are you starting from? Complete beginner"),
 * so the student can also just type a reply instead. A single one-choice
 * question is sent as soon as an option is tapped.
 */
const AskCard = ({ ask, active, onAnswer }) => {
  const questions = ask?.questions || [];
  const [picked, setPicked] = useState(() => questions.map(() => []));
  const [other, setOther] = useState(() => questions.map(() => ''));

  if (!questions.length) return null;

  const answerFor = (i) => [...picked[i], other[i].trim()].filter(Boolean).join(', ');
  const compose = () => questions
    .map((q, i) => (answerFor(i) ? `${q.question} ${answerFor(i)}` : null))
    .filter(Boolean)
    .join('\n');
  const answered = questions.filter((_, i) => answerFor(i)).length;

  const toggle = (i, option) => {
    const q = questions[i];
    if (questions.length === 1 && !q.multiSelect) {
      onAnswer(`${q.question} ${option}`);
      return;
    }
    setPicked((cur) => cur.map((list, j) => {
      if (j !== i) return list;
      if (!q.multiSelect) return list[0] === option ? [] : [option];
      return list.includes(option) ? list.filter((o) => o !== option) : [...list, option];
    }));
  };

  return (
    <div className={`mt-3 rounded-xl border px-4 py-3 ${active ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50/60 opacity-70'}`}>
      <div className="space-y-3.5">
        {questions.map((q, i) => (
          <fieldset key={`${q.key}-${q.question}`} disabled={!active}>
            <legend className="text-sm font-semibold text-gray-900">
              {q.question}
              {q.multiSelect && active && <span className="ml-1.5 text-xs font-normal text-gray-500">(pick any)</span>}
            </legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {q.options.map((o) => {
                const on = picked[i].includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggle(i, o)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-sm transition ${on ? 'border-blue-500 bg-blue-600 text-white' : 'border-gray-200 bg-surface text-gray-800 hover:border-blue-300 hover:bg-blue-50'} disabled:cursor-default disabled:hover:border-gray-200 disabled:hover:bg-surface`}
                  >
                    {o}
                  </button>
                );
              })}
              {active && (questions.length > 1 || q.multiSelect) && (
                <input
                  value={other[i]}
                  onChange={(e) => setOther((cur) => cur.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder="Something else…"
                  aria-label={`Other answer to: ${q.question}`}
                  maxLength={200}
                  className="min-w-[9rem] flex-1 rounded-full border border-dashed border-gray-300 bg-surface px-3 py-1 text-sm outline-none focus:border-blue-300"
                />
              )}
            </div>
          </fieldset>
        ))}
      </div>
      {active && (questions.length > 1 || questions[0].multiSelect) && (
        <div className="mt-3 flex items-center justify-end gap-3">
          <span className="text-xs text-gray-500">{answered} of {questions.length} answered · or just type below</span>
          <button
            type="button"
            disabled={!answered}
            onClick={() => onAnswer(compose())}
            className="rounded-lg bg-ink px-3.5 py-1.5 text-sm font-semibold text-on-ink hover:bg-ink-hover disabled:bg-gray-200 disabled:text-gray-400"
          >
            Send answers
          </button>
        </div>
      )}
    </div>
  );
};

export default AskCard;
