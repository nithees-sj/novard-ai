import React, { useEffect, useRef, useState } from 'react';
import logger from '../lib/logger';
import { useTheme } from '../context/ThemeContext';

// Diagram colours per theme. Mermaid bakes colours into the SVG it draws, so a
// theme switch draws the diagram again.
const THEME_VARIABLES = {
  light: {
    primaryColor: '#dbeafe',
    primaryBorderColor: '#2563eb',
    primaryTextColor: '#1e3a8a',
    lineColor: '#64748b',
    secondaryColor: '#fae8ff',
    tertiaryColor: '#f8fafc',
  },
  dark: {
    darkMode: true,
    background: '#121821',
    primaryColor: '#172a46',
    primaryBorderColor: '#60a5fa',
    primaryTextColor: '#e6eaf0',
    lineColor: '#94a3b8',
    secondaryColor: '#2e1a33',
    tertiaryColor: '#1a2230',
    textColor: '#e6eaf0',
    edgeLabelBackground: '#1a2230',
  },
};

// Mermaid is ~500 kB, so it is imported on demand the first time a diagram
// actually appears rather than being pulled into every route chunk.
let mermaidPromise = null;
export function loadMermaid() {
  if (!mermaidPromise) mermaidPromise = import('mermaid').then(({ default: mermaid }) => mermaid);
  return mermaidPromise;
}

// Mermaid's configuration is global and render() is async, so renders run one
// at a time: each sets its theme and draws before the next one starts.
let renderQueue = Promise.resolve();

/** Draw Mermaid `source` as an SVG string in the 'light' or 'dark' theme. */
export function renderMermaid(id, source, theme = 'light') {
  const run = renderQueue.then(async () => {
    const mermaid = await loadMermaid();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      fontFamily: 'Inter, Roboto, Helvetica Neue, Arial, sans-serif',
      themeVariables: { ...THEME_VARIABLES[theme === 'dark' ? 'dark' : 'light'], fontSize: '14px' },
      flowchart: { curve: 'basis', useMaxWidth: true },
      sequence: { useMaxWidth: true },
    });
    return mermaid.render(id, source);
  });
  renderQueue = run.catch(() => {});
  return run;
}

// Mermaid sizes each node to its label *before* drawing. If Inter (a web font)
// has not finished loading, labels are measured in the narrower fallback font
// and then clipped once Inter arrives ("Use bind moun"). Wait for it briefly.
let fontsReady = null;
function whenDiagramFontReady() {
  if (!fontsReady) {
    fontsReady = document.fonts?.load
      ? Promise.race([
        document.fonts.load('14px Inter').catch(() => {}),
        new Promise((resolve) => { setTimeout(resolve, 1500); }),
      ])
      : Promise.resolve();
  }
  return fontsReady;
}

let diagramSeq = 0;

/**
 * Renders one ```mermaid fenced block as an SVG diagram.
 *
 * Models do not always emit valid Mermaid, so a syntax error must not take the
 * surrounding summary down with it - on failure the original source is shown
 * as a plain code block instead.
 */
const MermaidDiagram = ({ chart }) => {
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const { resolved: theme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setDrawn(false);

    Promise.all([loadMermaid(), whenDiagramFontReady()])
      .then(async () => {
        if (cancelled) return;
        diagramSeq += 1;
        const id = `mermaid-diagram-${diagramSeq}`;
        try {
          const { svg } = await renderMermaid(id, chart.trim(), theme);
          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML = svg;
            setDrawn(true);
          }
        } catch (error) {
          logger.warn('Mermaid diagram could not be rendered', error?.message || error);
          // mermaid injects a hidden error node on failure; clear it.
          document.getElementById(`d${id}`)?.remove();
          if (!cancelled) setFailed(true);
        }
      })
      .catch((error) => {
        logger.warn('Mermaid failed to load', error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [chart, theme]);

  if (failed) {
    return (
      <pre className="not-prose my-4 first:mt-0 last:mb-0 overflow-x-auto rounded-lg bg-code p-4 text-xs text-code-fg dark:ring-1 dark:ring-line">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div className="not-prose my-4 first:mt-0 last:mb-0 overflow-x-auto rounded-lg border border-line bg-raised p-4">
      {/*
        Centred with margin:auto rather than flex justify-center. With flex,
        a diagram wider than this container overflows equally on both sides
        and the left edge becomes unreachable - overflow-x only scrolls right.
        Auto margins collapse to 0 once the child no longer fits, so a wide
        diagram stays fully scrollable.
      */}
      {/* The diagram library loads on first use and waits for the page font; say so instead of an empty box. */}
      {!drawn && (
        <div className="flex h-24 items-center justify-center gap-2 text-xs text-fg-subtle" role="status">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden="true" />
          Drawing diagram…
        </div>
      )}
      <div
        ref={containerRef}
        className="[&>svg]:mx-auto [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full [&_foreignObject]:overflow-visible"
      />
    </div>
  );
};

export default MermaidDiagram;
