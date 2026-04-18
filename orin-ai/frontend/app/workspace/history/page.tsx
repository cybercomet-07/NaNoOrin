"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";

const HISTORY = [
  {
    id: "1",
    name: "StudentMarket",
    date: "A few seconds ago",
    status: "Completed",
    type: "Marketplace"
  },
  {
    id: "2",
    name: "MedTriage AI",
    date: "2 days ago",
    status: "Completed",
    type: "SaaS"
  },
  {
    id: "3",
    name: "Crypto Tracker",
    date: "1 week ago",
    status: "Failed",
    type: "Mobile App"
  }
];

export default function HistoryPage() {
  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Workspace History</h1>
        <p className="text-muted text-lg">Review and manage your previously generated projects.</p>
      </div>

      <div className="flex gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input placeholder="Search projects..." className="pl-10" />
        </div>
        <Button variant="outline"><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <div className="grid gap-4">
        {HISTORY.map((project) => (
          <Card key={project.id} className="hover:border-white/20 transition-colors">
            <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center border border-white/5">
                  <span className="text-xl font-bold text-white/50">{project.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-muted">{project.date}</span>
                    <span className="text-muted">•</span>
                    <span className="text-sm text-muted">{project.type}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <Badge variant={project.status === "Completed" ? "success" : "outline"}>
                  {project.status}
                </Badge>
                
                <div className="flex gap-2">
                  <Link href="/workspace/report">
                    <Button variant="secondary" size="sm" className="hidden sm:flex">
                      <ExternalLink className="h-4 w-4 mr-2" /> Open Report
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm">
                    Regenerate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
