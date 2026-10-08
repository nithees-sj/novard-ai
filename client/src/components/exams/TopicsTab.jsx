import React, { useMemo, useState } from 'react';
import { Icon } from '../learning/LearningUI';
import { SectionHeader } from '../ui/Headers';
import { SegmentedControl } from '../ui/Tabs';
import Badge from '../ui/Badge';
import { IconButton } from '../ui/Button';
import cx from '../ui/cx';
import { pct, masteryTone, topicStatus, daysAgo } from '../../lib/exams';

const SORTS = [
  { id: 'order', label: 'Syllabus order' },
  { id: 'weak', label: 'Weakest first' },
  { id: 'share', label: 'Biggest share' },
];
const BAR = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' };

/** Every topic: its share of the exam, measured mastery against the target, and what to do about it. */
export default function TopicsTab({ exam, onAskTutor, onTeachBack }) {
  const [sort, setSort] = useState('order');
  const topics = useMemo(() => {
    const list = exam.topics.map((t, i) => ({ ...t, order: i }));
    if (sort === 'weak') return list.sort((a, b) => a.mastery - b.mastery || b.weight - a.weight);
    if (sort === 'share') return list.sort((a, b) => b.weight - a.weight);
    return list;
  }, [exam.topics, sort]);
  const target = exam.targetReadiness;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-6">
        <SectionHeader
          title={`${exam.topics.length} topics · ${exam.topics.filter((t) => t.learned).length} completed`}
          description={`A topic is completed when you pass a quiz or teach-back on it (${exam.passPercent ?? 50}% or more). Mastery fades when a topic isn’t practised; fainter bars rest on less evidence; the mark is your target.`}
          actions={<SegmentedControl size="sm" label="Sort topics" options={SORTS} value={sort} onChange={setSort} />}
        />
        <ul className="divide-y divide-line-subtle overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle">
          {topics.map((t) => {
            const status = topicStatus(t);
            const tone = t.learned ? masteryTone(t.mastery) : 'danger';
            return (
              <li key={t._id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 gap-y-3 px-4 py-4 md:grid-cols-[1.5rem_minmax(0,1fr)_13rem_auto] md:items-center md:gap-x-5">
                <span className="num pt-0.5 text-small text-fg-subtle md:pt-0">{t.order + 1}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-body font-medium text-fg">{t.name}</p>
                    {t.learned && <Badge tone="success" dot>Completed</Badge>}
                    {status && <span title={status.title}><Badge tone={status.tone}>{status.label}</Badge></span>}
                  </div>
                  {t.summary && <p className="mt-0.5 line-clamp-1 text-small text-fg-muted" title={t.summary}>{t.summary}</p>}
                  <p className="num mt-1 text-caption text-fg-subtle">
                    {pct(t.weight)} of the exam
                    {t.evidenceCount ? ` · ${t.evidenceCount} result${t.evidenceCount === 1 ? '' : 's'} · last practised ${daysAgo(t.daysSince)}` : ' · no results yet'}
                  </p>
                </div>

                <div className="col-start-2 md:col-start-auto">
                  <div className="flex items-baseline justify-between text-caption">
                    <span className="text-fg-subtle">Mastery</span>
                    <span className={cx('num text-small font-semibold', t.mastery >= target / 100 ? 'text-success-fg' : 'text-fg')}>{pct(t.mastery)}</span>
                  </div>
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-chart-track" role="img" aria-label={`${t.name}: mastery ${pct(t.mastery)} against a ${target}% target`}>
                    <div className={cx('h-1.5 rounded-full transition-all duration-500', BAR[tone])} style={{ width: `${Math.round(t.mastery * 100)}%`, opacity: 0.4 + 0.6 * t.confidence }} />
                    <span className="absolute -top-1 h-3.5 w-px bg-fg-muted" style={{ left: `${target}%` }} aria-hidden="true" />
                  </div>
                </div>

                <div className="col-start-2 flex items-center gap-0.5 md:col-start-auto">
                  <IconButton icon="chat" label={`Ask the tutor about ${t.name}`} onClick={() => onAskTutor(t)} />
                  <IconButton icon="teach" label={`Teach ${t.name} back to Novard`} onClick={() => onTeachBack(t)} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-caption text-fg-subtle">
          <Icon name="info" className="h-3.5 w-3.5" /> A topic can wait for the topics it builds on; Autopilot teaches foundations first.
        </p>
      </div>
    </div>
  );
}
