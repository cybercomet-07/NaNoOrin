import * as React from "react";
import { cn } from "@/lib/utils";
import BorderGlow from "@/components/BorderGlow";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "pending";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <BorderGlow
      className="inline-flex rounded-full !border-none p-[2px]"
      edgeSensitivity={30}
      glowColor="84 100 61"
      backgroundColor="transparent"
      borderRadius={9999}
      glowRadius={10}
      glowIntensity={1}
      animated={false}
      colors={['#c084fc', '#f472b6', '#38bdf8']}
    >
      <div
        className={cn(
          "inline-flex w-full h-full items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 relative z-10",
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
    </BorderGlow>
  );
}

export { Badge };
