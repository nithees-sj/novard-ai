import React, { useCallback, useEffect, useRef, useState } from 'react';
import { loadMermaid } from '../MermaidDiagram';

let seq = 0;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;

const ToolButton = ({ onClick, label, children, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className="h-8 min-w-[2rem] px-2 inline-flex items-center justify-center rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
  >
    {children}
  </button>
);

/**
 * Renders a roadmap's Mermaid source with zoom, fit-to-width, full screen and
 * SVG download. The diagram is rendered at its natural size (useMaxWidth is
 * off in the source) and scaled here, so text stays crisp at every zoom level.
 */
const RoadmapDiagram = ({ source, fileName = 'roadmap' }) => {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const natural = useRef({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [fullScreen, setFullScreen] = useState(false);

  const applyZoom = useCallback((z) => {
    const svg = canvasRef.current?.querySelector('svg');
    if (!svg || !natural.current.width) return;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    svg.style.width = `${natural.current.width * clamped}px`;
    svg.style.height = `${natural.current.height * clamped}px`;
    svg.style.maxWidth = 'none';
    setZoom(clamped);
  }, []);

  const fit = useCallback(() => {
    const available = (viewportRef.current?.clientWidth || 0) - 32;
    if (!available || !natural.current.width) return;
    applyZoom(Math.min(1, available / natural.current.width));
  }, [applyZoom]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadMermaid()
      .then(async (mermaid) => {
        seq += 1;
        const { svg } = await mermaid.render(`roadmap-${seq}`, source);
        if (cancelled || !canvasRef.current) return;
        canvasRef.current.innerHTML = svg;
        const el = canvasRef.current.querySelector('svg');
        const box = el.viewBox?.baseVal;
        natural.current = { width: box?.width || el.getBBox().width, height: box?.height || el.getBBox().height };
        el.removeAttribute('height');
        el.style.display = 'block';
        el.style.margin = '0 auto';
        setStatus('ready');
        requestAnimationFrame(fit);
      })
      .catch((error) => {
        console.error('Roadmap diagram failed to render:', error);
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
  }, [source, fit]);

  // Re-fit when entering or leaving full screen.
  useEffect(() => {
    if (status === 'ready') requestAnimationFrame(fit);
  }, [fullScreen, status, fit]);

  useEffect(() => {
    if (!fullScreen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setFullScreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullScreen]);

  const download = () => {
    const svg = canvasRef.current?.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', natural.current.width);
    clone.setAttribute('height', natural.current.height);
    clone.style.width = '';
    clone.style.height = '';
    clone.style.background = '#ffffff';
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-roadmap.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const frame = fullScreen
    ? 'fixed inset-0 z-[70] bg-white flex flex-col'
    : 'relative rounded-xl border border-gray-200 bg-white flex flex-col';

  return (
    <div className={frame}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <span className="text-xs text-gray-500">
          {status === 'ready' ? 'Scroll to explore · use the controls to zoom' : status === 'error' ? 'Diagram unavailable' : 'Drawing your roadmap…'}
        </span>
        <div className="flex items-center gap-1">
          <ToolButton onClick={() => applyZoom(zoom - 0.15)} label="Zoom out" disabled={status !== 'ready'}>−</ToolButton>
          <span className="w-12 text-center text-xs tabular-nums text-gray-600">{Math.round(zoom * 100)}%</span>
          <ToolButton onClick={() => applyZoom(zoom + 0.15)} label="Zoom in" disabled={status !== 'ready'}>+</ToolButton>
          <ToolButton onClick={fit} label="Fit to width" disabled={status !== 'ready'}>Fit</ToolButton>
          <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" />
          <ToolButton onClick={() => setFullScreen((v) => !v)} label={fullScreen ? 'Exit full screen' : 'Full screen'} disabled={status !== 'ready'}>
            {fullScreen ? 'Exit' : '⤢'}
          </ToolButton>
          <ToolButton onClick={download} label="Download as SVG" disabled={status !== 'ready'}>⬇ SVG</ToolButton>
        </div>
      </div>

      <div ref={viewportRef} className={`overflow-auto p-4 ${fullScreen ? 'flex-1' : 'max-h-[70vh]'}`}>
        {status === 'loading' && (
          <div className="h-64 flex items-center justify-center">
            <span className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-primary-600 animate-spin" aria-hidden="true" />
          </div>
        )}
        {status === 'error' && (
          <p className="text-sm text-gray-600 p-6 text-center">
            The diagram could not be drawn. The stage-by-stage plan below has everything it contains.
          </p>
        )}
        <div ref={canvasRef} className={status === 'ready' ? '' : 'hidden'} />
      </div>
    </div>
  );
};

export default RoadmapDiagram;
