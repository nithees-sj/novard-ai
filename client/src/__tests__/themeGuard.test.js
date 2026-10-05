/**
 * Keeps new code on the design system (src/theme/palette.js, tailwind.config.js,
 * components/ui; see docs/ui-changes.md): semantic colour tokens, the type,
 * radius and elevation scales, one icon set, no decorative gradients or emoji.
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

  it('uses the semantic tokens, not the old gray/blue/primary ramps (bg-sunken, text-fg-muted, border-line, bg-accent…)', () => {
    expect(offences(/\b(text|bg|border|ring|divide|fill|stroke|from|via|to|placeholder)-(gray|blue|primary)-\d/)).toEqual([]);
  });

  it('keeps text on the type scale: no arbitrary text-[…] sizes', () => {
    expect(offences(/\btext-\[\d/)).toEqual([]);
  });

  it('uses elevation shadows by name (raised, popover, modal), not the old size scale', () => {
    expect(offences(/\bshadow-(sm|md|lg|xl|2xl|soft|medium|hard)\b/)).toEqual([]);
  });

  it('has no decorative gradients', () => {
    expect(offences(/\bbg-gradient-to-/)).toEqual([]);
  });

  it('has no emoji in the interface (use the Icon set)', () => {
    expect(offences(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u)).toEqual([]);
  });

  it('has no uppercase tracked labels (sentence case, text-caption)', () => {
    expect(offences(/\buppercase tracking-(wide|wider|widest)\b/)).toEqual([]);
  });

  it('renders selects through ui/Field Select (styled, same focus ring)', () => {
    expect(offences(/<select\b/, (where) => where.startsWith('components/ui/Field.jsx:'))).toEqual([]);
  });
});
