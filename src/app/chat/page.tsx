"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconChevronLeft, IconSend, IconSparkles } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useAuthContext } from "@/context/AuthContext";
import { askTron } from "@/actions/chat";
import { executeClientTool } from "@/lib/tools";
import { runMemoryCommand } from "@/lib/tron/memory-commands";

export default function ChatPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || !user || isLoading) return;

    const text = input.trim();
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      // Memory is explicit in V1: "TRON, remember / forget / what do you
      // remember about ..." is handled here, deterministically, and never
      // reaches the model.
      const memoryReply = await runMemoryCommand(text);
      if (memoryReply !== null) {
        setMessages([...newMessages, { role: "assistant", content: memoryReply }]);
        return;
      }

      await processTurn(newMessages);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Something went wrong.";
      setMessages([...newMessages, { role: "assistant", content: detail }]);
    } finally {
      setIsLoading(false);
    }
  };

  const processTurn = async (currentMsgs: any[]) => {
    // 1. Call LLM
    let responseMsg = await askTron(currentMsgs);
    let updatedMsgs = [...currentMsgs, responseMsg];
    setMessages(updatedMsgs);

    // 2. Handle Tool Calls
    if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
      for (const tc of responseMsg.tool_calls) {
        // Execute tool client-side
        const resultStr = await executeClientTool(user!.uid, tc);
        
        // Append tool result
        const toolMsg = {
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: resultStr
        };
        updatedMsgs = [...updatedMsgs, toolMsg];
      }
      setMessages(updatedMsgs);
      
      // 3. Call LLM again with tool results
      await processTurn(updatedMsgs);
    }
  };

  return (
    <div className="flex flex-col full-bleed-screen">
      {/* Header */}
      <div className="pt-4 pb-4 px-4 flex items-center gap-3 border-b border-[var(--border)] shrink-0 z-10 relative">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--glass-bg-elevated)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
        >
          <IconChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-[17px] font-medium text-[var(--text-primary)] tracking-wide m-0">Ask TRON</h1>
            <IconSparkles size={14} className="text-sky-400" />
          </div>
          <p className="text-[12px] text-[var(--text-muted)] m-0 leading-tight">Query your own data</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
        {messages.filter(m => m.role !== "tool" && !(m.role === "assistant" && !m.content)).map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-sky-500/18 text-[var(--text-primary)] rounded-br-sm border border-sky-400/35"
                  : "bg-[var(--glass-bg)] text-[var(--text-primary)] rounded-bl-sm border border-[var(--glass-border)]"
              }`}
            >
              <span className="whitespace-pre-wrap">{msg.content}</span>
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 pt-4 above-nav shrink-0 border-t border-[var(--border)]">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask TRON anything…"
            disabled={isLoading}
            className="w-full bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full pl-5 pr-12 py-3.5 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-sky-400/60 transition-all disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-400 flex items-center justify-center text-[#04121f] disabled:opacity-30 disabled:bg-white/10 disabled:text-white/30 transition-all cursor-pointer"
          >
            <IconSend size={16} className="ml-[2px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
