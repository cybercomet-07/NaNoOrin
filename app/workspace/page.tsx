"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Sparkles, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function WorkspacePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.length < 10) {
      setError("Prompt must be at least 10 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to start pipeline");
        } else {
          const text = await res.text();
          throw new Error(`Server Error (${res.status}): ${text.slice(0, 50)}...`);
        }
      }

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const { run_id } = await res.json();
        router.push(`/run/${run_id}`);
      } else {
        throw new Error("Invalid response from server (Expected JSON)");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  const setExample = (text: string) => {
    setPrompt(text);
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto pt-16">
      
      <div className="mb-12 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-6 border border-primary/20 shadow-[0_0_30px_rgba(199,255,61,0.15)]">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white mb-4">
          What would you like to build today?
        </h1>
        <p className="text-lg text-muted">
          Describe your startup or product idea in a single prompt. Our AI agents will do the rest.
        </p>
      </div>

      <motion.div 
        className="relative group rounded-2xl bg-surface/50 p-2 border border-white/5 focus-within:border-primary/50 transition-colors shadow-lg backdrop-blur"
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (error) setError("");
          }}
          disabled={loading}
          placeholder="E.g., Build a marketplace for university students to sell textbooks with integrated Stripe payments..."
          className="min-h-[150px] border-none bg-transparent shadow-none focus-visible:ring-0 text-lg resize-none p-4 placeholder:text-muted/60"
        />

        {error && (
          <div className="px-4 pb-2">
            <p className="text-red-400 text-sm font-mono flex items-center gap-2">
              <span>⚠</span> {error}
            </p>
          </div>
        )}

        <div className="absolute bottom-6 right-6">
          <Button 
            onClick={handleGenerate} 
            disabled={loading || !prompt.trim()}
            size="lg" 
            className="h-12 px-8 shadow-[0_0_20px_rgba(199,255,61,0.2)] group-hover:shadow-[0_0_25px_rgba(199,255,61,0.4)]"
          >
            {loading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Initializing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Project
              </>
            )}
          </Button>
        </div>
      </motion.div>

      <div className="mt-8">
        <h3 className="text-sm font-medium text-muted mb-4 uppercase tracking-wider">Suggested Prompts</h3>
        <div className="flex flex-wrap gap-3">
          {[
            "Build an AI healthcare SaaS for patient triaging",
            "Create a fintech app for teenagers tracking allowances",
            "Build a crypto portfolio tracker with real-time alerts",
            "Create an HR platform for automated hiring flows"
          ].map((example, i) => (
            <button
              key={i}
              onClick={() => setExample(example)}
              className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Zap className="h-3 w-3 text-secondary mr-2" />
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
