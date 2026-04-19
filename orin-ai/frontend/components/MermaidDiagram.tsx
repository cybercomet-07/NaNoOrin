"use client";

import { useEffect, useMemo, useRef, useState } from "react";

let _mermaidInitialized = false;

/** Lazy-load mermaid only in the browser; SSR would throw. */
async function loadMermaid() {
  const mod = await import("mermaid");
  const mermaid = mod.default;
  if (!_mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "strict",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      themeVariables: {
        background: "#0a0a0a",
        primaryColor: "#1e293b",
        primaryTextColor: "#e2e8f0",
        primaryBorderColor: "#334155",
        lineColor: "#64748b",
        secondaryColor: "#0f172a",
        tertiaryColor: "#020617",
        mainBkg: "#1e293b",
        textColor: "#e2e8f0",
      },
      flowchart: { curve: "basis", padding: 18, htmlLabels: true },
      sequence: { mirrorActors: false, actorMargin: 40 },
    });
    _mermaidInitialized = true;
  }
  return mermaid;
}

interface MermaidDiagramProps {
  /** Mermaid source code. */
  source: string;
  /** Stable id prefix for SVG ids (avoids collisions when multiple render). */
  idPrefix?: string;
  /** Tailwind classes for the outer wrapper. */
  className?: string;
}

/**
 * Renders a Mermaid diagram from raw source.
 * Re-renders whenever `source` changes (debounced slightly to avoid thrashing
 * while the user is typing). Surfaces parse errors inline instead of crashing.
 */
export default function MermaidDiagram({
  source,
  idPrefix = "mermaid",
  className,
}: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const uniqueId = useMemo(
    () => `${idPrefix}-${Math.random().toString(36).slice(2, 9)}`,
    [idPrefix],
  );

  useEffect(() => {
    if (!source.trim()) {
      setSvg("");
      setError(null);
      return;
    }

    let cancelled = false;
    setIsRendering(true);
    setError(null);

    const renderHandle = window.setTimeout(async () => {
      try {
        const mermaid = await loadMermaid();
        const { svg: rendered } = await mermaid.render(uniqueId, source);
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : "Failed to render diagram.";
          setError(msg);
          setSvg("");
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(renderHandle);
    };
  }, [source, uniqueId]);

  return (
    <div
      className={
        "relative flex h-full w-full items-center justify-center overflow-auto " +
        "rounded-lg border border-white/10 bg-[#0a0a0a] p-6 " +
        (className ?? "")
      }
    >
      {!source.trim() && (
        <p className="text-sm text-white/40">
          No diagram yet — describe your system on the left and hit Generate.
        </p>
      )}

      {error && (
        <div className="max-w-md rounded-md border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
          <p className="mb-1 font-semibold">Mermaid parse error</p>
          <pre className="whitespace-pre-wrap font-mono text-xs text-red-300/80">
            {error}
          </pre>
        </div>
      )}

      {isRendering && !svg && !error && (
        <p className="text-sm text-white/50">Rendering diagram…</p>
      )}

      {svg && !error && (
        <div
          ref={containerRef}
          className="mermaid-svg-wrapper max-h-full max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}
