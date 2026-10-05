/**
 * Keeps new code themed (src/theme/palette.js). The light and dark themes
 * come from the ordinary Tailwind classes, except for a few that a palette
 * swap gets wrong; this fails when one of those is used.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');

function jsxFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : jsxFiles(full);
    return entry.name.endsWith('.jsx') ? [full] : [];
  });
}

const files = jsxFiles(SRC).map((file) => ({ file: path.relative(SRC, file), lines: fs.readFileSync(file, 'utf8').split('\n') }));

/** [file:line, text] for every line matching `pattern` and not `allowed`. */
const offences = (pattern, allowed = () => false) => files.flatMap(({ file, lines }) => lines
  .map((text, i) => [`${file}:${i + 1}`, text.trim()])
  .filter(([where, text]) => pattern.test(text) && !allowed(where, text)));

describe('theme guard', () => {
  it('uses bg-surface for cards and panels, not bg-white (white stays white in the dark theme)', () => {
    // Allowed: a white button on an always-dark (slate) banner.
    expect(offences(/\bbg-white(?![/\w-])/, (_, text) => text.includes('bg-white text-slate-900'))).toEqual([]);
  });

  it('uses ink, tooltip, code or slate for dark surfaces, not gray-800/900 (gray inverts in the dark theme)', () => {
    expect(offences(/\b(bg|from|via|to)-gray-(800|900|950)\b/)).toEqual([]);
  });

  it('keeps corners on the radius scale (sm, md, lg, xl, full): no 2xl/3xl or arbitrary radii', () => {
    expect(offences(/\brounded(-[trblse]{1,2})?-(2xl|3xl|\[)/)).toEqual([]);
  });

  it('keeps colours out of JSX (use classes, or lib/statusColors.js for values)', () => {
    // The animated brand marks and the Mermaid/theme colour tables are their own palettes.
    const OWN_PALETTE = ['components/ChatbotButton.jsx', 'components/agent/AgentAvatar.jsx', 'components/MermaidDiagram.jsx', 'components/roadmap/RoadmapDiagram.jsx', 'context/ThemeContext.jsx'];
    const hex = /(['"`(:\s])#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/;
    expect(offences(hex, (where) => OWN_PALETTE.some((f) => where.startsWith(`${f}:`)))).toEqual([]);
  });
});
