"use client";

import { Sidebar } from "@/components/shared/Sidebar";
import { motion } from "framer-motion";
import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background flex text-white selection:bg-primary/30">
      <Sidebar isVisible={isSidebarOpen} />
      
      <motion.main 
        initial={false}
        animate={{ 
          paddingLeft: isSidebarOpen ? "16rem" : "0rem" 
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex-1 relative min-h-screen"
      >
        {/* Toggle Button Container */}
        <div className="fixed top-6 left-6 z-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="h-9 w-9 bg-surface/80 backdrop-blur border border-white/10 hover:bg-surface/100 transition-colors shadow-lg shadow-black/20"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
            ) : (
              <PanelLeftOpen className="h-4 w-4 text-primary" />
            )}
          </Button>
        </div>

        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="h-full pt-12 md:pt-0"
          >
            {children}
          </motion.div>
        </div>
      </motion.main>
    </div>
  );
}
