/**
 * Starts a pipeline run via same-origin `/api/run` (Next rewrites to FastAPI).
 */

export async function startPipelineRun(prompt: string): Promise<string> {
  const trimmed = prompt.trim();
  if (trimmed.length < 10) {
    throw new Error("Prompt must be at least 10 characters");
  }

  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: trimmed }),
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
    let msg: string;
    if (typeof detail === "string") {
      msg = detail;
    } else if (Array.isArray(detail)) {
      msg = detail
        .map((d: unknown) => {
          const row = d as { msg?: string };
          return row.msg ?? JSON.stringify(d);
        })
        .join("; ");
    } else {
      msg = typeof obj.error === "string" ? obj.error : "Failed to start pipeline";
    }
    throw new Error(msg);
  }

  const runId = obj.run_id;
  if (typeof runId !== "string" || runId.length === 0) {
    throw new Error("Invalid response: missing run_id");
  }
  return runId;
}
