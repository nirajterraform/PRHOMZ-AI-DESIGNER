
import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Diamond, MoreHorizontal } from 'lucide-react';
import { chatWithArchitect } from '../services/geminiService';
import { ChatMessage } from '../types';

export const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: 'Greetings. I am PRHOMZ, your dedicated architectural consultant. How shall we refine your living concept today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const history = messages.map(m => ({ role: m.role, text: m.text }));
    
    try {
      const responseText = await chatWithArchitect(history, userMsg.text);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-160px)] flex flex-col glass-card rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl animate-fade-in">
      {/* Header */}
      <div className="p-8 bg-brand-950/40 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-5">
          <div className="w-12 h-12 bg-brand-500/10 rounded-2xl flex items-center justify-center border border-brand-500/20 shadow-inner">
            <Diamond className="w-6 h-6 text-brand-400 fill-brand-400/20" />
          </div>
          <div>
            <h3 className="font-serif text-2xl font-bold text-white tracking-tight leading-none">AI Consultant</h3>
            <div className="flex items-center space-x-2 mt-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <p className="text-[10px] text-brand-500 font-bold uppercase tracking-[0.2em]">Sourcing Intelligence Active</p>
            </div>
          </div>
        </div>
        <button className="p-3 hover:bg-white/5 rounded-full transition-colors text-brand-600">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-[75%] rounded-3xl p-6 transition-all animate-fade-in shadow-sm
              ${msg.role === 'user' 
                ? 'bg-brand-500 text-white rounded-br-none shadow-[0_10px_30px_rgba(86,119,114,0.2)]' 
                : 'bg-brand-900/50 text-brand-100 border border-white/5 rounded-bl-none'}
            `}>
              <p className="text-base leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</p>
              <div className={`text-[9px] mt-3 font-bold uppercase tracking-widest opacity-40 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {msg.role === 'user' ? 'Client' : 'PRHOMZ AI'}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-brand-900/50 rounded-3xl rounded-bl-none p-6 border border-white/5 flex space-x-2 items-center">
              <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
              <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-8 bg-brand-950/40 border-t border-white/5">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Discuss color theory, lighting placement, or material sourcing..."
            className="w-full bg-brand-950 border border-white/10 text-white rounded-[2rem] py-5 pl-8 pr-16 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/20 focus:outline-none placeholder-brand-700/60 transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 top-2.5 p-3.5 bg-brand-500 text-white rounded-full hover:bg-brand-400 disabled:opacity-30 disabled:grayscale transition-all shadow-xl hover:scale-110 active:scale-90"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-center text-[9px] text-brand-700 font-bold uppercase tracking-[0.3em] mt-4 opacity-50">
          Powered by Gemini Pro Vision • Architectural Inference Engine
        </p>
      </form>
    </div>
  );
};
