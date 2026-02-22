import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: { uri: string; title: string }[];
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your Gemini-powered assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const currentTime = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `You are a helpful, concise, and friendly AI assistant. The current date and time is ${currentTime}. You provide accurate information and engage in natural conversation. When asked about current events or real-time information, use your search tool to provide the most up-to-date and accurate results.`,
          tools: [{ googleSearch: {} }],
        },
      });

      // We'll use streaming for a better UX
      const responseStream = await chat.sendMessageStream({ message: input });
      
      const assistantMessageId = (Date.now() + 1).toString();
      let assistantContent = '';
      let sources: { uri: string; title: string }[] = [];

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);

      for await (const chunk of responseStream) {
        const chunkText = (chunk as GenerateContentResponse).text;
        
        // Extract grounding sources if available
        const groundingChunks = (chunk as GenerateContentResponse).candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
          groundingChunks.forEach(c => {
            if (c.web?.uri && c.web?.title) {
              if (!sources.find(s => s.uri === c.web?.uri)) {
                sources.push({ uri: c.web.uri, title: c.web.title });
              }
            }
          });
        }

        if (chunkText) {
          assistantContent += chunkText;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: assistantContent, sources: sources.length > 0 ? sources : undefined }
                : msg
            )
          );
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-white overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-bottom border-zinc-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-lg shadow-zinc-200">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Zentro</h1>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Your AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest">System Ready</span>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-4 max-w-[85%]",
              message.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-sm",
              message.role === 'user' ? "bg-zinc-100 text-zinc-600" : "bg-zinc-900 text-white"
            )}>
              {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={cn(
              "space-y-1.5",
              message.role === 'user' ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "px-4 py-3 rounded-2xl shadow-sm",
                message.role === 'user' 
                  ? "bg-zinc-900 text-white rounded-tr-none" 
                  : "bg-zinc-50 text-zinc-800 border border-zinc-100 rounded-tl-none"
              )}>
                <div className="markdown-body">
                  <Markdown>{message.content}</Markdown>
                </div>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-zinc-200/50">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {message.sources.map((source, idx) => (
                        <a
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-2 py-1 rounded-md transition-colors max-w-[200px] truncate"
                          title={source.title}
                        >
                          {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-zinc-400 font-medium px-1">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1].role === 'user' && (
          <div className="flex gap-4 max-w-[85%] mr-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
              <Loader2 size={16} className="animate-spin" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-zinc-50 text-zinc-400 border border-zinc-100 rounded-tl-none italic text-sm">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-6 bg-white border-t border-zinc-100">
        <form onSubmit={handleSubmit} className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="w-full pl-5 pr-14 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all placeholder:text-zinc-400 text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 bottom-2 px-4 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </form>
        <p className="mt-4 text-[10px] text-center text-zinc-400 font-medium uppercase tracking-widest">
          Powered by Gemini 3 Flash • Built for Exploration
        </p>
      </footer>
    </div>
  );
}
