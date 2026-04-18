import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import ClickSpark from "@/components/ClickSpark";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

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
    <html
      lang="en"
      className={`${inter.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClickSpark
          sparkColor="#C7FF3D"
          sparkSize={12}
          sparkRadius={25}
          sparkCount={10}
          duration={500}
        >
          {children}
        </ClickSpark>
      </body>
    </html>
  );
}
