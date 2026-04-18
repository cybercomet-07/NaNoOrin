// TODO: Phase 9 (Day 2) — AgentFeed component
// Displays live SSE events: agent_start, agent_complete, test_result, status_update
// Shows each agent's status as a timeline card

interface AgentEvent {
  event_type: "agent_start" | "agent_complete" | "test_result" | "status_update";
  agent: string;
  task_id: string;
  iteration: number;
  payload: Record<string, unknown>;
  timestamp: string;
}

interface AgentFeedProps {
  events: AgentEvent[];
}

export default function AgentFeed({ events }: AgentFeedProps) {
  // TODO: render event timeline
  return (
    <div>
      <h3>Agent Feed</h3>
      {/* TODO: map events to timeline cards */}
    </div>
  );
}
