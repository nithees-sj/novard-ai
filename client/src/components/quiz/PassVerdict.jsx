import React from 'react';
import Icon from '../ui/Icon';
import cx from '../ui/cx';

/**
 * The outcome of a quiz that completes a module (a Skill Plan day, an exam
 * topic): passed and completed, or the score against the pass mark and what
 * to do next.
 */
export default function PassVerdict({ percentage, passPercent, passed, completedLabel, retryHint, className }) {
  return (
    <div role="status" className={cx('flex items-start gap-3 rounded-lg px-4 py-3', passed ? 'bg-success-soft text-success-fg' : 'bg-warning-soft text-warning-fg', className)}>
      <Icon name={passed ? 'success' : 'warning'} className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-small">
        <p className="font-semibold">
          {passed ? `Passed with ${percentage}%` : `${percentage}% - the pass mark is ${passPercent}%`}
        </p>
        <p className="mt-0.5">{passed ? completedLabel : retryHint}</p>
      </div>
    </div>
  );
}
