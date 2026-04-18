import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OrinAI | One Prompt. Complete AI Workforce.",
  description: "Autonomous multi-agent AI platform to build and launch startups instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
