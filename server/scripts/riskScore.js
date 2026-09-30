/**
 * Score every area: features -> risk scores -> escalation alerts -> risk-object
 * lifecycle. Zero tokens, idempotent. Run it on a schedule, or by hand.
 *
 *   npm run risk:score --prefix server [-- --full]
 */
const { rescanAll } = require('../services/earlyWarning/rescan');
const { run, print } = require('./lib/cli');

run(async ({ full }) => {
  const r = await rescanAll({ trigger: 'cli', full: Boolean(full) });
  if (r.skipped) {
    print('Another rescan is running; skipped.');
    return;
  }
  print(`Scored ${r.scored} windows (${r.features} feature windows, levels from ${r.levelsFrom} thresholds) in ${r.ms} ms.`);
  print(r.alerts.length ? `${r.alerts.length} new alert(s):` : 'No new alerts.', ...r.alerts.map((a) => `  [${a.level}] ${a.message}`));
});
