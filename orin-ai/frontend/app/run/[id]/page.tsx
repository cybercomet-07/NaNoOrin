// TODO: Phase 9 (Day 2) — Live pipeline view for a specific run
// Subscribes to /stream/{id} via SSE and renders AgentFeed + TerminalPanel + ArtifactPanel

export default function RunPage({ params }: { params: { id: string } }) {
  const { id } = params;

  // TODO: use usePipelineStream(id) hook
  // TODO: render <AgentFeed />, <TerminalPanel />, <ArtifactPanel />

  return (
    <main>
      <h2>Run: {id}</h2>
      {/* TODO: AgentFeed */}
      {/* TODO: TerminalPanel */}
      {/* TODO: ArtifactPanel */}
    </main>
  );
}
