"use client";

import { Sidebar } from "@/components/shared/Sidebar";
import { motion } from "framer-motion";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex text-white selection:bg-primary/30">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="h-full"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
