import React, { useCallback, useEffect, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import FeatureNotice from '../components/FeatureNotice';
import CreateExam from '../components/exams/CreateExam';
import ExamView from '../components/exams/ExamView';
import { Workspace, SideList, ListItem, ListEmpty, LoadingPanel, Badge, Toast, Icon, btn, useToastTimer } from '../components/learning/LearningUI';
import confirm from '../components/ui/confirm';
import { useFeature } from '../context/AppStatusContext';
import { readParam, clearParam } from '../lib/openParam';
import { examsApi, pct } from '../lib/exams';

/** A row in the exam list from the full exam the dashboard shows. */
const listRow = (e) => ({
  _id: e._id,
  title: e.title,
  status: e.status,
  examDate: e.examDate,
  daysLeft: e.daysLeft,
  readiness: e.forecast?.now ?? 0,
  projected: e.forecast?.projected ?? 0,
  onTrack: e.forecast?.advice?.onTrack ?? null,
  todayTasks: e.today?.tasks.filter((t) => t.status === 'todo').length ?? 0,
});

/**
 * Exam Autopilot: every exam the student is preparing for, its live plan and
 * forecast, and the quizzes it sets. Opened directly with ?open=<id> (the bell,
 * the home card).
 */
export default function Exams() {
  const feature = useFeature('examAutopilot');
  const [exams, setExams] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = useToastTimer(setToast);

  const replace = useCallback((exam) => {
    setCurrent(exam);
    setExams((list) => (list.some((e) => e._id === exam._id) ? list.map((e) => (e._id === exam._id ? listRow(exam) : e)) : [listRow(exam), ...list]));
  }, []);

  const open = useCallback(async (id) => {
    try {
      replace(await examsApi.get(id));
      setCreating(false);
    } catch (e) {
      showToast(e.message || 'Could not open that exam.');
    }
  }, [replace, showToast]);

  useEffect(() => {
    const openId = readParam('open');
    clearParam('open');
    examsApi.list()
      .then((list) => {
        setExams(list);
        const next = openId || list.find((e) => e.status === 'active' && e.daysLeft >= 0)?._id || list[0]?._id;
        if (next) open(next);
        else setCreating(true);
      })
      .catch((e) => showToast(e.message || 'Could not load your exams.'))
      .finally(() => setLoaded(true));
  }, [open, showToast]);

  // Coming back to the tab (after a teach-back or the agent): pick up what changed.
  useEffect(() => {
    const onFocus = () => { if (current && !creating) examsApi.get(current._id).then(replace).catch(() => {}); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [current, creating, replace]);

  const remove = async (e) => {
    if (!(await confirm({ title: 'Delete this exam?', message: `“${e.title}”, its plan and its quiz results will be deleted.`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await examsApi.remove(e._id);
      setExams((list) => list.filter((x) => x._id !== e._id));
      if (current?._id === e._id) { setCurrent(null); setCreating(true); }
      showToast('Exam deleted.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not delete it.');
    }
  };

  return (
    <AppShell page="exams" width="full" title={current && !creating ? `${current.title} · Exam Autopilot` : undefined}>
      <FeatureNotice tool="examAutopilot" className="mb-4" />
      <Workspace
        side={(
          <SideList
            loading={!loaded}
            title="Your exams"
            count={exams.length}
            action={(
              <button type="button" onClick={() => setCreating(true)} aria-pressed={creating} disabled={!feature.enabled} className={`${creating ? btn.secondary : btn.primary} w-full`}>
                <Icon name="plus" /> {creating ? 'Planning an exam…' : 'Plan an exam'}
              </button>
            )}
          >
            {exams.length ? exams.map((e) => (
              <ListItem
                key={e._id}
                active={current?._id === e._id && !creating}
                title={e.title}
                subtitle={e.daysLeft > 0 ? `${e.daysLeft} day${e.daysLeft === 1 ? '' : 's'} to go${e.todayTasks ? ` · ${e.todayTasks} task${e.todayTasks === 1 ? '' : 's'} today` : ''}` : e.daysLeft === 0 ? 'Exam today' : 'Finished'}
                meta={`Ready ${pct(e.readiness)} · forecast ${pct(e.projected)}`}
                badges={e.daysLeft > 0 && e.onTrack !== null ? <Badge tone={e.onTrack ? 'success' : 'warning'} dot>{e.onTrack ? 'On track' : 'Behind'}</Badge> : null}
                onSelect={() => open(e._id)}
                onDelete={() => remove(e)}
              />
            )) : <ListEmpty icon="target" title="No exams yet" text="Add an exam date and syllabus, and Autopilot plans every day until it." />}
          </SideList>
        )}
      >
        {creating || (!current && loaded) ? (
          <CreateExam
            onCreated={(exam) => { replace(exam); setCreating(false); showToast('Your plan is ready.', 'success'); }}
            onCancel={current ? () => setCreating(false) : undefined}
          />
        ) : !current ? (
          <LoadingPanel label="Loading your exam…" />
        ) : (
          <ExamView key={current._id} exam={current} onChange={replace} onError={(m) => showToast(m)} />
        )}
      </Workspace>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}
