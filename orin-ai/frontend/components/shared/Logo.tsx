import Link from "next/link";
import { Zap } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 group">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary overflow-hidden">
        <Zap className="h-5 w-5 z-10" />
        <div className="absolute inset-0 bg-primary/20 blur-xl group-hover:bg-primary/40 transition-colors" />
      </div>
      <span className="text-xl font-bold tracking-tight text-white">
        Orin<span className="text-primary">AI</span>
      </span>
    </Link>
  );
}
