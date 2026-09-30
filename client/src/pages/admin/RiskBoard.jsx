import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { DriverList, ErrorNote, LevelBadge, Loading, PageHeader, Section, when } from '../../components/admin/ui';
import DataTable from '../../components/ui/DataTable';
import { Sparkline } from '../../components/profile/charts';
import { Badge, Spinner, btn } from '../../components/learning/LearningUI';
import useAdminData from '../../lib/useAdminData';
import { adminPost } from '../../lib/adminApi';
import { errorMessage } from '../../lib/api';

const SPARK_COLOR = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#b91c1c' };

/** Every app area's risk: level, score, 28-day trend and what drives it. */
export default function RiskBoard() {
  const { data, error, loading, reload } = useAdminData('/api/admin/risk/board');
  const [rescanning, setRescanning] = useState(false);
  const [note, setNote] = useState(null);
  const navigate = useNavigate();

  const rescan = async () => {
    setRescanning(true);
    setNote(null);
    try {
      const r = await adminPost('/api/admin/risk/rescan', {});
      setNote(r.skipped ? 'Another rescan is running; showing the latest scores.' : `Rescanned in ${r.ms} ms: ${r.alerts.length} new alert(s).`);
      await reload();
    } catch (err) {
      setNote(errorMessage(err, 'The rescan failed.'));
    } finally {
      setRescanning(false);
    }
  };

  const columns = [
    { key: 'label', label: 'Area', render: (r) => <span className="font-semibold text-gray-900">{r.label}</span> },
    { key: 'level', label: 'Level', render: (r) => <span className="flex items-center gap-2"><LevelBadge level={r.level} />{r.status === 'insufficient_baseline' && <Badge>new area</Badge>}</span> },
    { key: 'score', label: 'Score', className: 'tabular-nums', render: (r) => r.score.toFixed(3) },
    { key: 'trend', label: '28-day trend', render: (r) => <Sparkline values={r.sparkline.map((p) => p.score)} max={1} color={SPARK_COLOR[r.level]} label={`${r.label} risk trend`} /> },
    { key: 'drivers', label: 'Driven by', render: (r) => <DriverList drivers={r.drivers} /> },
    { key: 'reports', label: 'Open reports', className: 'tabular-nums', render: (r) => `${r.openReports}${r.urgentReports ? ` (${r.urgentReports} urgent)` : ''}` },
    { key: 'object', label: 'Tracking', render: (r) => (r.riskObject ? <span className="text-xs text-gray-600">{r.riskObject.topic} · {r.riskObject.state}{r.riskObject.flagged ? ' · flagged' : ''}</span> : <span className="text-xs text-gray-400">–</span>) },
  ];

  return (
    <AdminLayout title="ADMIN · RISK BOARD">
      <PageHeader
        title="Risk board"
        subtitle={data?.lastRescanAt ? `Scored ${when(data.lastRescanAt)}. Scores refresh when they are over an hour old.` : 'Each area scored against its own baseline'}
        actions={<button type="button" onClick={rescan} disabled={rescanning} className={btn.primary}>{rescanning ? <><Spinner /> Rescanning…</> : 'Rescan now'}</button>}
      />
      <ErrorNote error={error} onRetry={reload} />
      {note && <p className="mb-4 text-sm text-gray-600" role="status">{note}</p>}
      {loading && !data ? <Loading label="Scoring areas…" /> : data && (
        <Section>
          <DataTable columns={columns} rows={data.areas} rowKey={(r) => r.area} onRowClick={(r) => navigate(`/admin/risk/${r.area}`)} />
        </Section>
      )}
    </AdminLayout>
  );
}
