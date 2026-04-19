"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";

/**
 * Floating site-wide assistant.
 *
 * Appears on every page EXCEPT `/run/*` (the terminal / code / preview page).
 * Answers product questions about Orin AI via the backend `/chat` endpoint,
 * which routes through OpenRouter.
 */

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_GREETING: ChatTurn = {
  role: "assistant",
  content:
    "Hi! I'm Orin — your guide to this product. Ask me what Orin AI does, how the demo flow works, or what a run page shows. I'm also happy to point you at a Demo Prompt that matches your idea.",
};

const SUGGESTIONS = [
  "What is Orin AI?",
  "How do I try a demo?",
  "What happens on the run page?",
  "What's the Architecture page for?",
];

function isRunRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/run" || pathname.startsWith("/run/");
}

export function SiteChatbot() {
  const pathname = usePathname();
  const hidden = isRunRoute(pathname);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([INITIAL_GREETING]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (hidden && open) setOpen(false);
  }, [hidden, open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const nextHistory: ChatTurn[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextHistory);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory
            .slice(0, -1)
            .filter((m) => m !== INITIAL_GREETING)
            .slice(-10),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Chat service returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
        );
      }

      const data = (await res.json()) as { reply?: string };
      const reply = (data.reply || "").trim();
      if (!reply) throw new Error("Empty reply from chat service");

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry — I couldn't reach the assistant just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  if (hidden) return null;

  return (
    <>
      <AnimatePresence initial={false}>
        {!open && (
          <motion.button
            key="chatbot-bubble"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-black shadow-lg shadow-primary/30 ring-1 ring-primary/40 hover:shadow-primary/50 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/60"
            aria-label="Open Orin assistant"
          >
            <MessageCircle className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/70" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="chatbot-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-6 right-6 z-[60] flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/95 shadow-2xl shadow-black/50 backdrop-blur-xl sm:w-96"
          >
            <header className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-primary/20 via-transparent to-transparent px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <Bot className="h-4 w-4" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0a0a0a]" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">
                    Orin Assistant
                  </p>
                  <p className="text-[11px] text-white/50">
                    Ask me about the product
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm"
            >
              {messages.map((m, i) => (
                <ChatBubble key={i} role={m.role} content={m.content} />
              ))}

              {sending && (
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Orin is thinking…
                </div>
              )}

              {!sending && messages.length === 1 && (
                <div className="pt-2">
                  <p className="mb-2 flex items-center gap-1 text-[11px] uppercase tracking-wider text-white/40">
                    <Sparkles className="h-3 w-3" /> Try asking
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-1.5 text-[11px] text-red-300/80">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2 border-t border-white/10 bg-black/30 px-3 py-2.5"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask about Orin AI…"
                className="flex-1 resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-primary/50 focus:bg-white/10"
                maxLength={2000}
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ChatBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary/90 px-3 py-2 text-[13px] text-black"
            : "max-w-[85%] rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white/90"
        }
      >
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
      </div>
    </div>
  );
}

export default SiteChatbot;
