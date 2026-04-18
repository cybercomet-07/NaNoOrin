// TODO: Phase 9 (Day 2) — usePipelineStream hook
// Opens SSE connection to GET /stream/{run_id}
// Parses incoming events and accumulates state

import { useState, useEffect } from "react";

interface PipelineEvent {
  event_type: string;
  agent: string;
  task_id: string;
  iteration: number;
  payload: Record<string, unknown>;
  timestamp: string;
  status?: string;
}

interface PipelineStreamState {
  events: PipelineEvent[];
  status: string;
  isConnected: boolean;
  latestTest: { stdout: string; stderr: string; exit_code: number } | null;
}

export function usePipelineStream(runId: string): PipelineStreamState {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [status, setStatus] = useState("RUNNING");
  const [isConnected, setIsConnected] = useState(false);
  const [latestTest, setLatestTest] = useState<PipelineStreamState["latestTest"]>(null);

  useEffect(() => {
    if (!runId) return;

    // TODO: open EventSource to /stream/{runId}
    // TODO: on each message, parse JSON and append to events
    // TODO: if event.status in ["FINALIZED", "FAILED"] → close connection
    // TODO: handle reconnect on connection drop

    const es = new EventSource(`http://localhost:8000/stream/${runId}`);
    setIsConnected(true);

    es.onmessage = (e) => {
      const event: PipelineEvent = JSON.parse(e.data);
      setEvents((prev) => [...prev, event]);
      if (event.status) setStatus(event.status);
      if (event.event_type === "test_result") {
        setLatestTest(event.payload as PipelineStreamState["latestTest"]);
      }
      if (event.status === "FINALIZED" || event.status === "FAILED") {
        es.close();
        setIsConnected(false);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [runId]);

  return { events, status, isConnected, latestTest };
}
