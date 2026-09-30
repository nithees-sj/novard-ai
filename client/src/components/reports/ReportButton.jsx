import React from 'react';
import { Icon } from '../learning/LearningUI';
import { useReportProblem } from '../../context/ReportContext';

/**
 * A small "Report" action for an AI answer, summary or quiz question.
 * `report` is what the dialog opens with: { area, source: { itemType, itemId, messageIndex, excerpt } }.
 */
export default function ReportButton({ report, label = 'Report', className = '' }) {
  const open = useReportProblem();
  return (
    <button
      type="button"
      onClick={() => open(report)}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 ${className}`}
      title="Report a problem with this"
      aria-label={label === 'Report' ? 'Report a problem with this' : label}
    >
      <Icon name="flag" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
