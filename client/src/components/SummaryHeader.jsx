import React from 'react';

const ICONS = {
  document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
};

const TONES = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
};

/** Title row shown above every generated summary, so all summary panels line up the same way. */
const SummaryHeader = ({ title, subtitle, icon = 'document', tone = 'blue' }) => (
  <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-200">
    <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${TONES[tone]}`}>
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONS[icon]} />
      </svg>
    </div>
    <div className="min-w-0">
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
    </div>
  </div>
);

export default SummaryHeader;
