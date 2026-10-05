import React, { useCallback, useEffect, useState } from 'react';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';
import cx from '../ui/cx';
import { api } from '../../lib/api';
import logger from '../../lib/logger';
import { currentEmail } from '../../lib/session';
import { readOpenParam, clearOpenParam } from '../../lib/openParam';
import RoadmapForm from './RoadmapForm';
import RoadmapView from './RoadmapView';
import { REFERENCE_ROADMAPS } from '../../lib/referenceRoadmaps';

const userId = () => currentEmail();

/**
 * Smart Roadmap: generate a personalised roadmap from the student's target
 * role and situation, view it as a flow diagram plus a stage-by-stage plan,
 * and keep every roadmap they have generated. The original pre-drawn roadmap
 * images stay available as references.
 *
 * Layout matches the other tools: main area on the left, the student's
 * roadmaps in a panel on the right. It opens on the generator.
 */
const RoadmapWorkspace = ({ heightClass = '' }) => {
  const [list, setList] = useState([]);
  const [view, setView] = useState('form'); // form | roadmap | reference
  const [current, setCurrent] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [reference, setReference] = useState(null);
  const [preset, setPreset] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [showReferences, setShowReferences] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/roadmaps/user/${encodeURIComponent(userId())}`);
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.error('Error loading roadmaps', err);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const openRoadmap = async (id) => {
    setLoadingId(id);
    setError(null);
    try {
      const { data } = await api.get(`/api/roadmaps/${id}`, { params: { userId: userId() } });
      setCurrent(data);
      setView('roadmap');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not open that roadmap.');
    } finally {
      setLoadingId(null);
    }
  };

  // Opened from the Novard Agent's "Open roadmap" link.
  useEffect(() => {
    const id = readOpenParam();
    if (id) {
      openRoadmap(id);
      clearOpenParam();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async (values) => {
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post(`/api/roadmaps/generate`, { ...values, userId: userId() });
      setCurrent(data);
      setView('roadmap');
      setPreset(null);
      loadList();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate the roadmap. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const remove = async () => {
    if (!current) return;
    setDeleting(true);
    try {
      await api.delete(`/api/roadmaps/${current._id}`, { data: { userId: userId() } });
      setCurrent(null);
      setView('form');
      loadList();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete the roadmap.');
    } finally {
      setDeleting(false);
    }
  };

  const newRoadmap = (presetValues = null) => {
    setPreset(presetValues);
    setError(null);
    setView('form');
  };

  const regenerate = () => {
    if (!current) return;
    const i = current.inputs || {};
    newRoadmap({
      role: current.role,
      level: i.level || 'beginner',
      hoursPerWeek: i.hoursPerWeek || 10,
      timelineMonths: i.timelineMonths || 6,
      knownSkills: i.knownSkills || [],
      goal: i.goal || '',
    });
  };

  const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <div className={cx('flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-0 md:overflow-hidden md:rounded-xl md:bg-raised md:ring-1 md:ring-line-subtle', heightClass)}>
      {/* Left pane: the student's roadmaps */}
      <aside className="flex max-h-[24rem] shrink-0 flex-col overflow-hidden rounded-xl bg-raised ring-1 ring-line-subtle md:max-h-none md:w-72 md:rounded-none md:border-r md:border-line-subtle md:bg-canvas/60 md:ring-0" aria-label="Your roadmaps">
        <div className="px-4 pb-3 pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-body font-semibold text-fg">Your roadmaps</h3>
            {list.length > 0 && <span className="tabular text-caption text-fg-subtle">{list.length}</span>}
          </div>
          <Button
            onClick={() => newRoadmap()}
            aria-pressed={view === 'form'}
            variant={view === 'form' ? 'secondary' : 'primary'}
            icon={view === 'form' ? undefined : 'plus'}
            disabled={view === 'form'}
            block
          >
            {view === 'form' ? 'Creating a new roadmap…' : 'New roadmap'}
          </Button>
        </div>

        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {list.length === 0 ? (
            <p className="px-4 py-8 text-center text-small text-fg-subtle">Roadmaps you generate are kept here.</p>
          ) : list.map((r) => {
            const active = view === 'roadmap' && current?._id === r._id;
            return (
              <button
                key={r._id}
                type="button"
                onClick={() => openRoadmap(r._id)}
                aria-current={active ? 'true' : undefined}
                className={cx(
                  'w-full rounded-lg px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                  active ? 'bg-accent-soft' : 'hover:bg-sunken',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cx('truncate text-body font-medium', active ? 'text-accent-fg' : 'text-fg')}>{r.role}</span>
                  {loadingId === r._id && <Spinner className="h-3.5 w-3.5 text-accent-fg" />}
                </div>
                <div className="tabular mt-0.5 text-caption text-fg-subtle">
                  {r.stageCount} stages · {r.totalWeeks} weeks · {formatDate(r.createdAt)}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-line-subtle">
          <button
            type="button"
            onClick={() => setShowReferences((v) => !v)}
            aria-expanded={showReferences}
            className="flex w-full items-center justify-between px-4 py-3 text-small font-medium text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
          >
            Reference roadmaps
            <Icon name="chevronDown" className={cx('h-4 w-4 text-fg-subtle transition-transform duration-200', showReferences && 'rotate-180')} />
          </button>
          {showReferences && (
            <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto px-3 pb-3">
              {REFERENCE_ROADMAPS.map((r) => {
                const on = view === 'reference' && reference?.name === r.name;
                return (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => { setReference(r); setView('reference'); }}
                    aria-current={on ? 'true' : undefined}
                    className={cx('truncate rounded px-2 py-1.5 text-left text-caption font-medium transition-colors', on ? 'bg-accent-soft text-accent-fg' : 'text-fg-muted hover:bg-sunken hover:text-fg')}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Right pane */}
      <main className="min-h-[28rem] min-w-0 flex-1 rounded-xl bg-raised ring-1 ring-line-subtle md:min-h-0 md:overflow-y-auto md:rounded-none md:ring-0">
        <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8 sm:py-8">
          {view === 'form' && (
            <RoadmapForm onSubmit={generate} generating={generating} error={error} initial={preset} />
          )}

          {view === 'roadmap' && current && (
            <>
              {error && <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-4 py-3 text-body text-danger-fg">{error}</p>}
              <RoadmapView roadmap={current} onDelete={remove} onRegenerate={regenerate} deleting={deleting} />
            </>
          )}

          {view === 'reference' && reference && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-small text-fg-subtle">Reference roadmap</p>
                  <h2 className="text-display font-semibold text-fg">{reference.name}</h2>
                </div>
                <Button onClick={() => newRoadmap({ role: reference.role })} icon="sparkles">Make a personalised version</Button>
              </div>
              <img src={reference.imageUrl} alt={`${reference.name} reference roadmap`} loading="lazy" className="h-auto w-full rounded-lg bg-raised ring-1 ring-line-subtle" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default RoadmapWorkspace;
