"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/shared/Logo";

const AGENTS = [
  { id: "SCOUT", role: "Analyzing competitors..." },
  { id: "PERSONA", role: "Simulating user flow..." },
  { id: "BLUEPRINT", role: "Designing architecture..." },
  { id: "FORGE", role: "Generating backend & frontend..." },
  { id: "VERDICT", role: "Running tests..." },
  { id: "SENTINEL", role: "Preparing report & audits..." }
];

export default function ProcessingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (activeStep < AGENTS.length) {
      const timer = setTimeout(() => {
        setActiveStep(prev => prev + 1);
      }, 1500); // 1.5s per agent step
      return () => clearTimeout(timer);
    } else {
      // Finished all agents, redirect to report
      setTimeout(() => {
        router.push("/workspace/report");
      }, 1000);
    }
  }, [activeStep, router]);

  const progress = Math.min(((activeStep + 1) / AGENTS.length) * 100, 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Background glow */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[80vw] h-[80vw] max-w-4xl max-h-4xl rounded-full bg-primary/5 blur-[120px] animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-3xl px-6 text-center">
        <div className="flex justify-center mb-12">
          <Logo />
        </div>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
          Building Your Project...
        </h1>
        <p className="text-lg text-muted mb-16 h-8">
          {AGENTS[Math.min(activeStep, AGENTS.length - 1)].role}
        </p>

        {/* Neural Network Nodes Sequence */}
        <div className="relative flex justify-between items-center mb-24 max-w-2xl mx-auto">
          {/* Progress Line */}
          <div className="absolute top-1/2 left-0 w-full h-1 bg-white/5 -translate-y-1/2 z-0" />
          <motion.div 
            className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 z-0"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />

          {AGENTS.map((agent, index) => {
            const isCompleted = index < activeStep;
            const isActive = index === activeStep;
            
            return (
              <div key={agent.id} className="relative z-10 flex flex-col items-center group">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: isActive ? 1.2 : 1, opacity: 1 }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted ? "bg-primary border-primary text-black" :
                    isActive ? "bg-surface border-2 border-primary shadow-[0_0_20px_rgba(199,255,61,0.5)] bg-primary/10" :
                    "bg-surface border border-white/10 text-muted"
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">{index + 1}</span>
                  )}
                </motion.div>
                <div className="absolute top-16 whitespace-nowrap text-xs font-mono font-medium transition-colors duration-300" 
                  style={{ color: isActive ? "#C7FF3D" : isCompleted ? "#fff" : "#A1A1AA" }}>
                  {agent.id}
                </div>
              </div>
            );
          })}
        </div>

        {/* Global Progress Base */}
        <div className="w-full max-w-sm mx-auto flex flex-col items-center">
          <div className="text-2xl font-bold text-white mb-2">{Math.round(progress)}%</div>
          <div className="text-xs text-muted">Estimated time remaining: 00:0{6 - activeStep}</div>
        </div>
      </div>
    </div>
  );
}
