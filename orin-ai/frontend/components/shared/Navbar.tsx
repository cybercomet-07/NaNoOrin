import Link from "next/link";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/60 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="hidden md:flex gap-6 items-center">
          <Link href="#product" className="text-sm font-medium text-muted hover:text-white transition-colors">
            Product
          </Link>
          <Link href="#how-it-works" className="text-sm font-medium text-muted hover:text-white transition-colors">
            How It Works
          </Link>
          <Link href="#pricing" className="text-sm font-medium text-muted hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="#about" className="text-sm font-medium text-muted hover:text-white transition-colors">
            About
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-white hover:text-primary transition-colors hidden sm:block">
            Log in
          </Link>
          <Link href="/login">
            <Button size="sm">Start Free</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
