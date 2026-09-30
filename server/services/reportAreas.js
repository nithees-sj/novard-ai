const settings = require('./settingsService');
const { AREA_KEYWORDS } = require('../config/earlyWarning');

/**
 * The live list of app areas (the `reports.areas` setting). An area merged
 * into another reports and scores as that one.
 */

async function areas() {
  return (await settings.get('reports')).areas;
}

/** { id: { id, label } } for the areas reports can be filed under (merged ones excluded). */
async function activeAreas() {
  const list = await areas();
  return list.filter((a) => !a.mergedInto).map(({ id, label }) => ({ id, label }));
}

/** The area a (possibly merged) id counts as, or null if unknown. */
async function resolveArea(id) {
  const list = await areas();
  const byId = new Map(list.map((a) => [a.id, a]));
  let area = byId.get(id);
  for (let hops = 0; area?.mergedInto && hops < 5; hops += 1) area = byId.get(area.mergedInto);
  return area && !area.mergedInto ? area.id : null;
}

/** Label for an area id (falls back to the id). */
async function areaLabel(id) {
  return (await areas()).find((a) => a.id === id)?.label || id;
}

/** Map of id -> label, merged areas included (for display). */
async function areaLabels() {
  return Object.fromEntries((await areas()).map((a) => [a.id, a.label]));
}

/** EWDI-style keyword routing: the first area whose words appear in the text, or null. */
function routeByKeywords(text) {
  const hit = AREA_KEYWORDS.find(([, pattern]) => pattern.test(String(text || '')));
  return hit ? hit[0] : null;
}

module.exports = { areas, activeAreas, resolveArea, areaLabel, areaLabels, routeByKeywords };
