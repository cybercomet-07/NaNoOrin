import * as React from "react";
import { cn } from "@/lib/utils";
import BorderGlow from "@/components/BorderGlow";

export type InputProps = React.ComponentPropsWithoutRef<"input">;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <BorderGlow
        className={cn("w-full rounded-md !border-none", className?.includes("h-") ? "" : "")}
        edgeSensitivity={30}
        glowColor="84 100 61"
        backgroundColor="transparent"
        borderRadius={6}
        glowRadius={10}
        glowIntensity={1}
        animated={false}
        colors={['#c084fc', '#f472b6', '#38bdf8']}
      >
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-white/10 bg-surface px-3 py-2 text-sm text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-colors relative z-10",
            className
          )}
        ref={ref}
        {...props}
      />
      </BorderGlow>
    );
  }
);
Input.displayName = "Input";

export { Input };
