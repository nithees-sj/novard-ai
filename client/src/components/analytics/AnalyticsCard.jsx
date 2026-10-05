import React from 'react';
import Icon from '../ui/Icon';
import cx from '../ui/cx';

const TREND = {
  up: { color: 'text-success-fg', icon: 'arrowUp' },
  down: { color: 'text-danger-fg', icon: 'arrowDown' },
  flat: { color: 'text-fg-subtle', icon: null },
};

/**
 * One number on the dashboard, as a cell of the stat strip: label, value,
 * what it is out of, an optional signed change, and how it was worked out
 * (`detail`) so it is never a black box. Older props (icon, iconBg,
 * iconColor) are accepted and ignored.
 */
const AnalyticsCard = ({ title, value, subtitle, trend, trendDirection, trendLabel, trendTone, detail }) => {
  const style = TREND[trendDirection] || null;
  const color = trendTone === 'warning' ? 'text-warning-fg' : style?.color || 'text-fg-muted';

  return (
    <div className="flex min-w-0 flex-col bg-raised px-5 py-4">
      <p className="text-small text-fg-muted">{title}</p>
      <p className="num mt-1.5 text-display font-medium text-fg">{value}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-small">
        {subtitle && <span className="text-fg-subtle">{subtitle}</span>}
        {trend && (
          <span className={cx('inline-flex items-center gap-0.5 font-medium', color)} title={trendLabel || undefined}>
            {style?.icon && <Icon name={style.icon} className="h-3 w-3" strokeWidth={2.25} />}
            {trend}
            {trendLabel && <span className="font-normal text-fg-subtle"> {trendLabel}</span>}
          </span>
        )}
      </div>
      {detail && <p className="mt-auto pt-3 text-caption text-fg-subtle">{detail}</p>}
    </div>
  );
};

export default AnalyticsCard;
