import React, { useEffect, useRef, useState } from 'react';

// Mermaid is ~500 kB, so it is imported on demand the first time a diagram
// actually appears rather than being pulled into every route chunk.
let mermaidPromise = null;
export function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        fontFamily: 'Inter, Roboto, Helvetica Neue, Arial, sans-serif',
        themeVariables: {
          primaryColor: '#e0f2fe',
          primaryBorderColor: '#0284c7',
          primaryTextColor: '#0c4a6e',
          lineColor: '#64748b',
          secondaryColor: '#fae8ff',
          tertiaryColor: '#f8fafc',
          fontSize: '14px',
        },
        flowchart: { curve: 'basis', useMaxWidth: true },
        sequence: { useMaxWidth: true },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
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

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    loadMermaid()
      .then(async (mermaid) => {
        if (cancelled) return;
        diagramSeq += 1;
        const id = `mermaid-diagram-${diagramSeq}`;
        try {
          const { svg } = await mermaid.render(id, chart.trim());
          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        } catch (error) {
          console.warn('Mermaid diagram could not be rendered:', error?.message || error);
          // mermaid injects a hidden error node on failure; clear it.
          document.getElementById(`d${id}`)?.remove();
          if (!cancelled) setFailed(true);
        }
      })
      .catch((error) => {
        console.warn('Mermaid failed to load:', error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (failed) {
    return (
      <pre className="not-prose my-4 first:mt-0 last:mb-0 overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div className="not-prose my-4 first:mt-0 last:mb-0 overflow-x-auto rounded-lg border border-gray-200 bg-white p-4">
      {/*
        Centred with margin:auto rather than flex justify-center. With flex,
        a diagram wider than this container overflows equally on both sides
        and the left edge becomes unreachable - overflow-x only scrolls right.
        Auto margins collapse to 0 once the child no longer fits, so a wide
        diagram stays fully scrollable.
      */}
      <div
        ref={containerRef}
        className="min-h-[60px] [&>svg]:mx-auto [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full"
      />
    </div>
  );
};

export default MermaidDiagram;
