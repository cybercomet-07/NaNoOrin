"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Message {
  id: string
  role: "user" | "agent"
  content: string
  agentName?: string
}

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "agent", content: "Orin AI Engine online. Ready to assist with your autonomous pipeline.", agentName: "Supervisor" }
  ])
  const [input, setInput] = useState("")

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")

    // Simulate agent response
    setTimeout(() => {
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: `Acknowledged. Processing your request in the current pipeline context.`,
        agentName: "Supervisor"
      }
      setMessages(prev => [...prev, agentMessage])
    }, 1000)
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-[#0d0d0d]/50 shrink-0">
        <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--terminal-gray)]">
          Agent Conversation
        </h2>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                 {m.role === "agent" && (
                   <span className="text-[10px] font-mono text-[var(--terminal-green)] uppercase">
                     {m.agentName}
                   </span>
                 )}
                 <span className="text-[9px] text-[var(--terminal-gray)] opacity-50 uppercase font-mono">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 </span>
              </div>
              <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed font-mono ${
                m.role === "user" 
                  ? "bg-[var(--terminal-green)] text-black rounded-tr-none shadow-[0_0_15px_rgba(var(--terminal-green-rgb),0.2)]" 
                  : "bg-white/5 text-[var(--terminal-text)] border border-white/10 rounded-tl-none"
              }`}>
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 bg-[#0d0d0d]/50">
        <form onSubmit={handleSend} className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
            placeholder="Type your instruction..."
            className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 pr-12 text-xs font-mono text-white placeholder:text-[var(--terminal-gray)]/50 focus:outline-none focus:border-[var(--terminal-green)]/50 transition-all resize-none min-h-[44px] max-h-32"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2 bottom-2 p-2 rounded-lg bg-[var(--terminal-green)] text-black disabled:opacity-50 disabled:grayscale transition-all hover:scale-105 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14m-7-7l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
