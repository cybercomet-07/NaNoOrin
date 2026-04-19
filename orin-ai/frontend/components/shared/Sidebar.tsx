"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import {
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Network,
  Settings,
  Sparkles,
  PanelLeftClose,
} from "lucide-react";
import { cn } from "@/lib/utils";
import BorderGlow from "@/components/BorderGlow";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function Sidebar({ isVisible, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.replace("/");
  };

  const links = [
    { href: "/workspace/demo", label: "Demo Prompts", icon: Sparkles },
    { href: "/workspace", label: "New Run", icon: LayoutDashboard },
    { href: "/workspace/architecture", label: "Architecture", icon: Network },
    { href: "/workspace/history", label: "History", icon: Clock },
    { href: "/workspace/report", label: "Reports", icon: FileText },
    { href: "/workspace/settings", label: "Settings", icon: Settings },
  ];

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.aside
          initial={{ x: -256, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -256, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="w-64 border-r border-white/5 bg-transparent backdrop-blur-[2px] h-screen flex flex-col pt-6 pb-4 fixed z-40 group"
        >
          <div className="px-6 mb-12 flex items-center justify-between">
            <Logo />
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {links.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/workspace" && pathname.startsWith(link.href));
              return (
                <BorderGlow
                  key={link.href}
                  className="w-full rounded-md !border-none"
                  edgeSensitivity={30}
                  glowColor="84 100 61"
                  backgroundColor={
                    isActive ? "rgba(199,255,61,0.1)" : "transparent"
                  }
                  borderRadius={6}
                  glowRadius={15}
                  glowIntensity={1}
                  animated={false}
                  colors={["#c084fc", "#f472b6", "#38bdf8"]}
                >
                  <Link
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all w-full h-full relative z-10",
                      isActive ? "text-primary" : "text-muted hover:text-white",
                    )}
                  >
                    <link.icon
                      className={cn(
                        "h-4 w-4",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    {link.label}
                  </Link>
                </BorderGlow>
              );
            })}
          </nav>

          <div className="px-3 mt-auto mb-4 space-y-2">
            {session && (
              <div className="px-3 py-2 rounded-md border border-white/5 bg-surface/50 text-xs font-mono">
                <div className="text-[var(--terminal-gray)] uppercase tracking-widest text-[10px] mb-0.5">
                  Signed in
                </div>
                <div className="text-white/90 truncate">{session.email}</div>
              </div>
            )}
            <BorderGlow
              className="w-full rounded-md !border-none"
              edgeSensitivity={30}
              glowColor="0 100 50"
              backgroundColor="transparent"
              borderRadius={6}
              glowRadius={15}
              glowIntensity={1}
              animated={false}
              colors={["#ef4444", "#f87171", "#fca5a5"]}
            >
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-500 transition-all w-full h-full relative z-10 text-left"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </BorderGlow>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
