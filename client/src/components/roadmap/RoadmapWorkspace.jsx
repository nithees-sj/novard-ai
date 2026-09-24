import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { readOpenParam, clearOpenParam } from '../../lib/openParam';
import RoadmapForm from './RoadmapForm';
import RoadmapView from './RoadmapView';
import { REFERENCE_ROADMAPS } from '../../lib/referenceRoadmaps';

const apiUrl = process.env.REACT_APP_API_ENDPOINT;
const userId = () => localStorage.getItem('email') || 'demo-user';

/**
 * Smart Roadmap: generate a personalised roadmap from the student's target
 * role and situation, view it as a flow diagram plus a stage-by-stage plan,
 * and keep every roadmap they have generated. The original pre-drawn roadmap
 * images stay available as references.
 *
 * Layout matches the other tools: main area on the left, the student's
 * roadmaps in a panel on the right. It opens on the generator.
 */
const RoadmapWorkspace = ({ heightClass = 'h-[calc(100vh-200px)]' }) => {
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
      const { data } = await axios.get(`${apiUrl}/api/roadmaps/user/${encodeURIComponent(userId())}`);
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading roadmaps:', err);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const openRoadmap = async (id) => {
    setLoadingId(id);
    setError(null);
    try {
      const { data } = await axios.get(`${apiUrl}/api/roadmaps/${id}`, { params: { userId: userId() } });
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
      const { data } = await axios.post(`${apiUrl}/api/roadmaps/generate`, { ...values, userId: userId() });
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
      await axios.delete(`${apiUrl}/api/roadmaps/${current._id}`, { data: { userId: userId() } });
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
    <div className={`flex gap-6 ${heightClass}`}>
      {/* Main area */}
      <main className="flex-1 min-w-0 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/40 p-6">
        {view === 'form' && (
          <RoadmapForm onSubmit={generate} generating={generating} error={error} initial={preset} />
        )}

        {view === 'roadmap' && current && (
          <>
            {error && <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
            <RoadmapView roadmap={current} onDelete={remove} onRegenerate={regenerate} deleting={deleting} />
          </>
        )}

        {view === 'reference' && reference && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reference roadmap</p>
                <h2 className="text-2xl font-bold text-gray-900">{reference.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => newRoadmap({ role: reference.role })}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Generate a personalised version
              </button>
            </div>
            <img src={reference.imageUrl} alt={`${reference.name} reference roadmap`} loading="lazy" className="w-full h-auto rounded-xl border border-gray-200 bg-white" />
          </div>
        )}
      </main>

      {/* Right panel: the student's roadmaps */}
      <aside className="w-80 shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden" aria-label="Your roadmaps">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Your Roadmaps</h3>
          <button
            type="button"
            onClick={() => newRoadmap()}
            aria-pressed={view === 'form'}
            className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${view === 'form'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {view === 'form' ? 'Creating a new roadmap…' : '+ New Roadmap'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {list.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8 px-4">
              Your generated roadmaps will appear here.
            </p>
          ) : list.map((r) => {
            const active = view === 'roadmap' && current?._id === r._id;
            return (
              <button
                key={r._id}
                type="button"
                onClick={() => openRoadmap(r._id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${active
                  ? 'bg-indigo-50 border-indigo-200 border-l-4 border-l-indigo-600'
                  : 'bg-white border-gray-200 hover:border-gray-300'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold truncate ${active ? 'text-indigo-800' : 'text-gray-900'}`}>{r.role}</span>
                  {loadingId === r._id && <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 border-t-indigo-600 animate-spin" aria-hidden="true" />}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {r.stageCount} stages · {r.totalWeeks} weeks · {formatDate(r.createdAt)}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowReferences((v) => !v)}
            aria-expanded={showReferences}
            className="w-full flex items-center justify-between pl-4 pr-24 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Reference roadmaps
            <span className={`text-gray-400 transition-transform ${showReferences ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
          </button>
          {showReferences && (
            <div className="max-h-56 overflow-y-auto px-3 pb-3 grid grid-cols-2 gap-1.5">
              {REFERENCE_ROADMAPS.map((r) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => { setReference(r); setView('reference'); }}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium text-left truncate ${view === 'reference' && reference?.name === r.name
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default RoadmapWorkspace;
