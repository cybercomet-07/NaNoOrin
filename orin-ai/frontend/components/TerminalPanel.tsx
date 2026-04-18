// TODO: Phase 9 (Day 2) — TerminalPanel component
// Shows live stdout/stderr from E2B sandbox execution
// Mimics a terminal window — dark background, monospace font

interface TerminalPanelProps {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  iteration: number;
}

export default function TerminalPanel({ stdout, stderr, exitCode, iteration }: TerminalPanelProps) {
  // TODO: render terminal-style output with ANSI colour support
  return (
    <div style={{ fontFamily: "monospace", background: "#1e1e1e", color: "#d4d4d4", padding: 16 }}>
      <div>Iteration {iteration} — exit code: {exitCode ?? "running..."}</div>
      <pre>{stdout}</pre>
      {stderr && <pre style={{ color: "#f48771" }}>{stderr}</pre>}
    </div>
  );
}
