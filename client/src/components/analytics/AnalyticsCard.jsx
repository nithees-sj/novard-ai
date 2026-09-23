import React from 'react';

const TREND_STYLES = {
  up: { color: 'text-green-600', arrow: '▲' },
  down: { color: 'text-red-600', arrow: '▼' },
  flat: { color: 'text-gray-500', arrow: '' },
};

/**
 * Stat tile: label, value, a short explanation, and an optional signed change.
 * `trendDirection` colours the change by whether it is good news; `detail`
 * shows how the number was arrived at so it is never a black box.
 */
const AnalyticsCard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendDirection,
  trendLabel,
  trendColor,
  detail,
  iconBg = 'bg-blue-50',
  iconColor = 'text-blue-600',
}) => {
  const style = TREND_STYLES[trendDirection] || null;
  const color = trendColor || style?.color || 'text-green-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">{title}</span>
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center shrink-0`}>
          <span className={`text-xl ${iconColor}`} aria-hidden="true">{icon}</span>
        </div>
      </div>

      <div className="mb-2">
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm text-gray-500 whitespace-nowrap">{subtitle}</span>
        {trend && (
          <span className={`text-xs font-semibold whitespace-nowrap ${color}`} title={trendLabel || undefined}>
            {style?.arrow && <span aria-hidden="true">{style.arrow} </span>}
            {trend}
            {trendLabel && <span className="font-normal text-gray-400"> {trendLabel}</span>}
          </span>
        )}
      </div>

      {detail && (
        <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">{detail}</p>
      )}
    </div>
  );
};

export default AnalyticsCard;
