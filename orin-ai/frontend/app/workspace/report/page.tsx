"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Globe, Code, FileText, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ReportPage() {
  const [showWebsiteModal, setShowWebsiteModal] = useState(false);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8 pb-12">
      {/* HEADER OVERVIEW */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface/30 p-8 rounded-2xl border border-white/5 backdrop-blur-md shadow-lg shadow-black/20">
        <div>
          <Badge variant="success" className="mb-4">Project Generated Successfully</Badge>
          <h1 className="text-3xl font-bold text-white">StudentMarket</h1>
          <p className="text-muted mt-2 text-lg">Your startup blueprint is ready.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button variant="outline" className="h-11">
            <Download className="mr-2 h-4 w-4" /> Export ZIP
          </Button>
          <Button onClick={() => setShowWebsiteModal(true)} className="h-11 shadow-[0_0_20px_rgba(199,255,61,0.2)]">
            <Globe className="mr-2 h-4 w-4" /> Generate Website
          </Button>
        </div>
      </div>

      {/* DASHBOARD STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Security Score</CardDescription>
            <CardTitle className="text-3xl font-bold text-primary">98/100</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted flex items-center mt-1">
              <CheckCircle2 className="h-3 w-3 mr-1 text-primary" /> Audited by SENTINEL
            </div>
          </CardContent>
        </Card>
          <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Market Competitiveness</CardDescription>
            <CardTitle className="text-3xl font-bold text-secondary">High</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted flex items-center mt-1">
              <FileText className="h-3 w-3 mr-1 text-secondary" /> 5 major gaps found
            </div>
          </CardContent>
        </Card>
          <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Architecture Stack</CardDescription>
            <CardTitle className="text-3xl font-bold text-white">Next.js + Supabase</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            </div>
          </CardContent>
        </Card>
          <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Code Status</CardDescription>
            <CardTitle className="text-3xl font-bold text-white">Production Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted flex items-center mt-1">
              <Code className="h-3 w-3 mr-1" /> 15 components compiled
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TWO COLUMNS CONTENT */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-8">
            <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
            <CardHeader>
              <CardTitle>Market Opportunity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-white/80 leading-relaxed">
                The university textbook marketplace is currently monopolized by official campus bookstores with high overhead. 
                Peer-to-peer selling exists only in fragmented Facebook groups. 
                A centralized, secure digital platform dedicated to campuses creates an immediate value proposition.
              </p>
              <div className="h-32 bg-surface/50 rounded-lg border border-white/5 flex items-end px-6 py-4 gap-4">
                {/* Mock Chart */}
                <div className="w-12 bg-white/10 rounded-t-sm h-[40%]"></div>
                <div className="w-12 bg-white/20 rounded-t-sm h-[60%]"></div>
                <div className="w-12 bg-primary/60 rounded-t-sm h-[100%] shadow-[0_0_15px_rgba(199,255,61,0.3)]"></div>
              </div>
            </CardContent>
          </Card>

            <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
            <CardHeader>
              <CardTitle>Generated Architecture</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-surface/50 border border-white/5">
                  <div className="font-semibold text-white mb-2">Frontend</div>
                  <div className="text-sm text-muted">React (Next.js 15), App Router, Tailwind CSS, Framer Motion</div>
                </div>
                <div className="p-4 rounded-lg bg-surface/50 border border-white/5">
                  <div className="font-semibold text-white mb-2">Backend & Database</div>
                  <div className="text-sm text-muted">Supabase PostgreSQL, Prisma ORM, Edge Functions</div>
                </div>
                <div className="p-4 rounded-lg bg-surface/50 border border-white/5">
                  <div className="font-semibold text-white mb-2">Payments</div>
                  <div className="text-sm text-muted">Stripe Connect (Peer-to-peer splitting)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
            <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
            <CardHeader>
              <CardTitle>User Personas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold">1</div>
                <div>
                  <div className="text-sm font-semibold text-white">Freshman Buyer</div>
                  <div className="text-xs text-muted">Price sensitive, looking for syllabus-matched local books.</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</div>
                <div>
                  <div className="text-sm font-semibold text-white">Senior Seller</div>
                  <div className="text-xs text-muted">Wants quick cash, prefers campus meetups or local dropoffs.</div>
                </div>
              </div>
            </CardContent>
          </Card>

            <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
            <CardHeader>
              <CardTitle>Feature Roadmap</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-white/90">
                  <Badge className="w-16 justify-center">V1.0</Badge> User Auth & Listings
                </li>
                <li className="flex items-center gap-3 text-sm text-white/90">
                  <Badge className="w-16 justify-center">V1.0</Badge> Smart Search by Syllabus
                </li>
                <li className="flex items-center gap-3 text-sm text-white/60">
                  <Badge variant="outline" className="w-16 justify-center">V1.5</Badge> Stripe Integration
                </li>
                <li className="flex items-center gap-3 text-sm text-white/60">
                  <Badge variant="outline" className="w-16 justify-center">V2.0</Badge> Campus Delivery
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Website Generator Modal */}
      {showWebsiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]"
          >
            <div className="w-full md:w-1/2 p-8 flex flex-col border-r border-white/5">
              <h2 className="text-2xl font-bold text-white mb-2">Instant Website Builder</h2>
              <p className="text-sm text-muted mb-8">Turn your generated startup into a live frontend instantly.</p>
              
              <div className="space-y-6 flex-1">
                <div>
                  <label className="text-sm font-medium text-white mb-3 block">Website Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Landing Page', 'SaaS Dashboard', 'Marketplace', 'Mobile UI'].map(type => (
                      <button key={type} className="border border-white/10 hover:border-primary/50 bg-card rounded-md py-2 text-sm text-white transition-colors">
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-white mb-3 block">Theme Profile</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Dark Premium', 'Minimal Light', 'Startup Neon', 'Cyber Futuristic'].map(theme => (
                      <button key={theme} className="border border-white/10 hover:border-secondary/50 bg-card rounded-md py-2 text-sm text-white transition-colors">
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="pt-6 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowWebsiteModal(false)}>Cancel</Button>
                <Button className="flex-1">Generate Website</Button>
              </div>
            </div>
            <div className="w-full md:w-1/2 bg-[#0a0a0a] relative p-6 flex flex-col justify-center items-center">
              <div className="absolute top-4 left-4 flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <Globe className="h-16 w-16 text-white/10 mb-4" />
              <p className="text-white/40 text-sm">Live preview will appear here</p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
