import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Attachment } from '../types';

interface ChatInputProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  disabled: boolean;
  suggestions?: string[];
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled, suggestions = [] }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    // Pass empty array for attachments as feature is removed from UI
    onSend(text, []);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleSuggestionClick = (suggestion: string) => {
      onSend(suggestion, []);
  };

  return (
    <div className="w-full max-w-4xl mx-auto md:px-0 flex flex-col gap-2">
        {/* Suggestions Bar */}
        {suggestions.length > 0 && !disabled && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1 mask-linear-fade">
                {suggestions.map((suggestion, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="flex items-center gap-1.5 whitespace-nowrap bg-white border border-yellow-200 text-yellow-800 text-xs md:text-sm px-3 py-1.5 rounded-full hover:bg-yellow-50 hover:border-yellow-400 transition-all shadow-sm active:scale-95"
                    >
                        <Sparkles size={12} className="text-yellow-500" />
                        {suggestion}
                    </button>
                ))}
            </div>
        )}

      <div className="relative flex items-end gap-1.5 md:gap-2 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl p-2 focus-within:ring-2 focus-within:ring-yellow-400/50 focus-within:border-yellow-400 focus-within:bg-white transition-all shadow-sm">
        
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu consulta..."
          className="flex-1 max-h-[150px] py-2 pl-2 bg-transparent border-0 focus:ring-0 resize-none text-slate-900 placeholder:text-slate-400 leading-relaxed text-sm md:text-base"
          rows={1}
          disabled={disabled}
        />

        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className={`p-2 rounded-lg mb-0.5 shrink-0 transition-all ${
            text.trim() && !disabled
              ? 'bg-yellow-400 text-yellow-900 shadow-sm hover:bg-yellow-500 transform hover:-translate-y-0.5'
              : 'bg-transparent text-slate-300 cursor-not-allowed'
          }`}
        >
          <Send size={20} />
        </button>
      </div>
      
      {/* Footer text hidden on mobile to save space */}
      <div className="text-center hidden md:block">
         <p className="text-[10px] md:text-xs text-slate-400">
             Antelito puede cometer errores. Verifica la información importante.
         </p>
      </div>
    </div>
  );
};

export default ChatInput;