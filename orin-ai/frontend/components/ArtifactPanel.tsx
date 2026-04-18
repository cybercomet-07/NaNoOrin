// TODO: Phase 9 (Day 2) — ArtifactPanel component
// Displays generated code files from /artifacts/{run_id}
// Syntax-highlighted file tabs: app.py, requirements.txt, test_app.py

interface ArtifactPanelProps {
  files: Record<string, string>; // {filename: code_string}
}

export default function ArtifactPanel({ files }: ArtifactPanelProps) {
  // TODO: render tabbed file viewer with syntax highlighting (e.g. Shiki or Prism)
  return (
    <div>
      <h3>Generated Artifacts</h3>
      {/* TODO: file tabs */}
      {Object.entries(files).map(([filename, code]) => (
        <div key={filename}>
          <h4>{filename}</h4>
          <pre><code>{code}</code></pre>
        </div>
      ))}
    </div>
  );
}
