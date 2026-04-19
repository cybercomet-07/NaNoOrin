/**
 * Client for the architecture-diagram extension (POST /api/diagram).
 * Sends a prompt + diagram kind, gets back Mermaid source.
 */

export type DiagramKind =
  | "flowchart"
  | "sequence"
  | "architecture"
  | "er"
  | "class"
  | "state";

export interface DiagramResponse {
  mermaid: string;
  model: string;
  kind: DiagramKind;
  fallback_used: boolean;
}

export async function generateDiagram(
  prompt: string,
  kind: DiagramKind = "architecture",
  signal?: AbortSignal,
): Promise<DiagramResponse> {
  const trimmed = prompt.trim();
  if (trimmed.length < 5) {
    throw new Error("Prompt must be at least 5 characters.");
  }

  const res = await fetch("/api/diagram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: trimmed, kind }),
    signal,
  });

  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  const obj = body as Record<string, unknown>;

  if (!res.ok) {
    const detail = obj.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : typeof obj.error === "string"
          ? obj.error
          : `Diagram generation failed (${res.status}).`;
    throw new Error(msg);
  }

  if (typeof obj.mermaid !== "string" || !obj.mermaid.trim()) {
    throw new Error("Empty diagram returned from the model.");
  }

  return {
    mermaid: obj.mermaid,
    model: typeof obj.model === "string" ? obj.model : "unknown",
    kind: (obj.kind as DiagramKind) ?? kind,
    fallback_used: Boolean(obj.fallback_used),
  };
}

export const DIAGRAM_KINDS: Array<{
  value: DiagramKind;
  label: string;
  hint: string;
}> = [
  {
    value: "architecture",
    label: "Architecture",
    hint: "Components grouped by layer — best for system overviews.",
  },
  {
    value: "flowchart",
    label: "Flowchart",
    hint: "Top-down flow of actions, decisions, and data.",
  },
  {
    value: "sequence",
    label: "Sequence",
    hint: "Request/response between actors over time.",
  },
  {
    value: "er",
    label: "ER Diagram",
    hint: "Database entities and their relationships.",
  },
  {
    value: "class",
    label: "Class Diagram",
    hint: "OOP classes, fields, methods, and inheritance.",
  },
  {
    value: "state",
    label: "State Diagram",
    hint: "Lifecycle states and their transitions.",
  },
];
