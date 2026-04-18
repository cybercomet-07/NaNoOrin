"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { Clock, FileText, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/workspace", label: "New Run", icon: LayoutDashboard },
    { href: "/workspace/history", label: "History", icon: Clock },
    { href: "/workspace/report", label: "Reports", icon: FileText },
    { href: "/workspace/settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-white/5 bg-surface/50 h-screen flex flex-col pt-6 pb-4 fixed">
      <div className="px-6 mb-12">
        <Logo />
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/workspace" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted hover:bg-white/5 hover:text-white"
              )}
            >
              <link.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 mt-auto">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-500 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Link>
      </div>
    </aside>
  );
}
