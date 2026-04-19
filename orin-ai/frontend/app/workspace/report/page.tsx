"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listRuns } from "@/lib/runHistory";

/**
 * Legacy /workspace/report route.
 *
 * Previously this page showed a fixed mock ("StudentMarket"). Now it simply
 * redirects to the report for the most recent run, or to an empty state if the
 * user hasn't generated anything yet.
 */
export default function ReportIndexPage() {
  const router = useRouter();

  useEffect(() => {
    const runs = listRuns();
    if (runs.length > 0) {
      router.replace(`/workspace/report/${runs[0].runId}`);
    }
  }, [router]);

  return (
    <div className="max-w-3xl mx-auto py-12">
      <Card className="bg-surface/30 border-white/10 backdrop-blur-md">
        <CardHeader>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/30 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-white">No report to show yet</CardTitle>
          <CardDescription>
            Reports are generated from your actual runs. Once a run finishes,
            this page will jump straight to its report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Link href="/workspace/demo">
              <Button>
                Browse demo prompts <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/workspace/history">
              <Button variant="outline">Open History</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
