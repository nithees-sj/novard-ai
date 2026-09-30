const settings = require('./settingsService');
const { activeAreas } = require('./reportAreas');
const { TOOLS } = require('../config/admin');

/**
 * What the student app needs to know about the platform's state: which tools
 * are switched off (and the message to show), known-issue notices, maintenance
 * mode and the dashboard banner. Public (no secrets): the landing page shows
 * maintenance too.
 */
async function appStatus(now = new Date()) {
  const keys = [...Object.keys(TOOLS).map((t) => `features.${t}`), 'maintenance.global', 'banners.dashboard', 'reports'];
  const s = await settings.getMany(keys);

  const features = Object.fromEntries(Object.entries(TOOLS).map(([tool, { label, area }]) => {
    const flag = s[`features.${tool}`];
    return [tool, { label, area, enabled: flag.enabled, message: flag.message, notice: flag.notice }];
  }));

  const banner = s['banners.dashboard'];
  const bannerActive = banner.enabled && (banner.title || banner.body) && (!banner.until || new Date(banner.until) > now);

  const { voiceEnabled } = require('../ai/transcribe');
  return {
    features,
    maintenance: s['maintenance.global'],
    banner: bannerActive ? { title: banner.title, body: banner.body, until: banner.until } : null,
    // What the "Report a problem" form needs.
    reports: {
      areas: await activeAreas(),
      maxOpenPerArea: s.reports.maxOpenPerArea,
      voiceEnabled: await voiceEnabled(),
    },
  };
}

module.exports = { appStatus };
