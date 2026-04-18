import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import BorderGlow from "@/components/BorderGlow";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, ...props }, ref) => {
    return (
      <BorderGlow
        className={cn(
          "inline-flex overflow-visible p-[2px] !border-none !bg-transparent group",
          className?.includes("w-full") && "w-full"
        )}
        edgeSensitivity={30}
        glowColor="84 100 61" 
        backgroundColor="transparent"
        borderRadius={size === "sm" ? 6 : size === "lg" ? 8 : 6}
        glowRadius={15}
        glowIntensity={1}
        coneSpread={25}
        animated={false}
        colors={['#c084fc', '#f472b6', '#38bdf8']}
      >
        <button
          ref={ref}
        disabled={isLoading || props.disabled}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          {
            "bg-primary text-black hover:bg-primary/90 shadow-[0_0_15px_rgba(199,255,61,0.3)] hover:shadow-[0_0_20px_rgba(199,255,61,0.5)]":
              variant === "default",
            "bg-secondary/10 text-secondary hover:bg-secondary/20": variant === "secondary",
            "border border-white/10 bg-transparent hover:bg-white/5 text-white":
              variant === "outline",
            "hover:bg-white/10 text-white": variant === "ghost",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-md px-3": size === "sm",
            "h-11 rounded-md px-8 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
        </button>
      </BorderGlow>
    );
  }
);
Button.displayName = "Button";

export { Button };
