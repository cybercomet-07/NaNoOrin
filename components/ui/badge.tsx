import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "pending";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        {
          "border-transparent bg-primary text-black": variant === "default",
          "border-transparent bg-secondary text-black": variant === "secondary",
          "border-white/20 text-white": variant === "outline",
          "border-transparent bg-green-500/20 text-green-400": variant === "success",
          "border-transparent bg-yellow-500/20 text-yellow-400": variant === "pending",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
