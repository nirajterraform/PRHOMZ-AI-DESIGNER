
import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Info } from 'lucide-react';
import { chatWithDesigner } from '../services/geminiService';
import { ChatMessage } from '../types';

export const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: 'Hi, I’m PRHOMZ AI DESIGNER.\n\nI can help you refine your interior style, suggest spatial changes, or help you source specific pieces.\n\nWhat’s on your mind today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const responseText = await chatWithDesigner(history, userMsg.text);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: responseText }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Helper to format text with line breaks and handle **bold** syntax
   */
  const formatMessage = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Skip empty lines between paragraphs for cleaner spacing
      if (!line.trim() && i > 0) return <div key={i} className="h-2" />;

      // Simple regex to find **text** and replace with styled spans
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span key={j} className="font-extrabold text-google-blue">
              {part.slice(2, -2)}
            </span>
          );
        }
        return part;
      });

      // Handle bullet points
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
      
      return (
        <p key={i} className={`${isBullet ? 'pl-4 relative' : ''} leading-relaxed mb-1`}>
          {isBullet && <span className="absolute left-0 text-google-blue">•</span>}
          {formattedLine}
        </p>
      );
    });
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-160px)] flex flex-col bg-google-surface border border-google-border rounded-2xl overflow-hidden shadow-lg animate-fade">
      {/* Header */}
      <div className="px-6 py-4 border-b border-google-border flex items-center justify-between bg-google-bg/50 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-google-blue/10 rounded-lg flex items-center justify-center border border-google-blue/20">
            <Sparkles size={18} className="text-google-blue" />
          </div>
          <h3 className="font-semibold text-google-dark">PRHOMZ AI DESIGNER</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">Live</span>
          <button className="text-google-gray hover:text-google-dark p-1">
            <Info size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-google-bg scroll-smooth">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start max-w-[90%] space-x-3 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
                ${msg.role === 'user' ? 'bg-google-dark text-google-bg shadow-md' : 'bg-google-surface text-google-blue border border-google-border'}
              `}>
                {msg.role === 'user' ? <User size={14}/> : <Sparkles size={14}/>}
              </div>
              <div className={`rounded-2xl px-5 py-3.5 text-sm
                ${msg.role === 'user' 
                  ? 'bg-google-blue text-google-bg font-medium shadow-sm' 
                  : 'bg-google-surface text-google-dark border border-google-border shadow-sm'}
              `}>
                {formatMessage(msg.text)}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-google-surface rounded-2xl px-5 py-3 flex space-x-1.5 items-center border border-google-border">
              <div className="w-1.5 h-1.5 bg-google-blue/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-google-blue/60 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
              <div className="w-1.5 h-1.5 bg-google-blue/60 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-google-border bg-google-surface">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your design..."
            className="w-full bg-google-bg border border-google-border text-google-dark rounded-full py-4 pl-6 pr-14 focus:ring-2 focus:ring-google-blue focus:outline-none shadow-inner text-sm placeholder-google-gray transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1.5 p-2.5 bg-google-blue text-google-bg rounded-full hover:brightness-110 transition-all disabled:opacity-30 shadow-md group-hover:scale-105"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};
