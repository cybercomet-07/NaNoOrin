"use client";

import { Sidebar } from "@/components/shared/Sidebar";
import { motion } from "framer-motion";
import { useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { SnowBackground } from "@/components/shared/SnowBackground";
import AuthGuard from "@/components/AuthGuard";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();

  const snowRoutes = [
    "/workspace",
    "/workspace/demo",
    "/workspace/architecture",
    "/workspace/history",
    "/workspace/report",
    "/workspace/settings",
  ];
  const shouldShowSnow = snowRoutes.includes(pathname);

  const content = (
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
  );

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background flex text-white selection:bg-primary/30">
      <Sidebar
        isVisible={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(false)}
      />

      <motion.main
        initial={false}
        animate={{
          paddingLeft: isSidebarOpen ? "16rem" : "0rem",
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex-1 relative min-h-screen"
      >
        {!isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="fixed top-6 left-6 z-50 transition-all"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
              className="h-10 w-10 bg-surface/80 backdrop-blur border border-white/10 hover:bg-surface/100 transition-colors shadow-lg shadow-black/20"
            >
              <PanelLeftOpen className="h-5 w-5 text-primary" />
            </Button>
          </motion.div>
        )}

        {shouldShowSnow ? (
          <SnowBackground>{content}</SnowBackground>
        ) : (
          content
        )}
      </motion.main>
    </div>
    </AuthGuard>
  );
}
