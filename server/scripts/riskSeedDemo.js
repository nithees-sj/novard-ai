/**
 * Make a real risk escalation happen, for a demo (EWDI demo_risk.py).
 * Seeds a quiet baseline in every area and a ramping spike in one, then runs
 * the normal scoring pass: the alert you see is the detector reacting to data.
 *
 *   npm run risk:seed-demo --prefix server -- --area video-summarizer [--student you@gmail.com]
 *   npm run risk:seed-demo --prefix server -- --clear
 *
 * --student gives your account two of the spike reports, so you receive the
 * "resolved" notification when an admin resolves them. Everything created is
 * tagged and --clear removes exactly that.
 */
const { seedDemo, clearDemo } = require('../services/earlyWarning/demoSeed');
const { run, print } = require('./lib/cli');

run(async ({ area = 'video-summarizer', student, clear }) => {
  if (clear) {
    const r = await clearDemo();
    print(`Removed the demo: ${r.reports} reports, ${r.modelCalls} model calls, ${r.gatewayEvents} gateway events. Scores recomputed from real data.`);
    return;
  }
  const r = await seedDemo({ area, student: typeof student === 'string' ? student : undefined });
  print(`Seeded ${r.reports} reports (${r.spikeReports} open in ${r.area}), ${r.modelCalls} model calls and ${r.gatewayEvents} gateway events.`);
  if (r.skipped) print('Scoring was skipped because another rescan was running; run npm run risk:score --prefix server -- --full.');
  else if (r.alerts.length) print(`${r.alerts.length} alert(s) raised:`, ...r.alerts.map((a) => `  [${a.level}] ${a.message}`));
  else print('No escalation detected (already alerted, or the spike did not clear the HIGH threshold).');
  print('', 'Next: sign in at /admin/login and open the risk board.');
});
