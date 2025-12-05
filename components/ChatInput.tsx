import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X } from 'lucide-react';
import { Attachment } from '../types';

interface ChatInputProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  disabled: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || disabled) return;
    onSend(text, attachments);
    setText('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    // Simple basic validation
    if (!file.type.startsWith('image/')) {
        alert("Solo se admiten imágenes por ahora.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result as string;
        // Result is "data:image/jpeg;base64,....."
        // We need to extract the base64 part for Gemini
        const base64Data = result.split(',')[1];
        
        setAttachments(prev => [...prev, {
            type: 'image',
            mimeType: file.type,
            data: base64Data
        }]);
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 pt-0">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
            <div className="flex gap-2 mb-2 px-2 overflow-x-auto">
                {attachments.map((att, idx) => (
                    <div key={idx} className="relative group shrink-0">
                        <img 
                            src={`data:${att.mimeType};base64,${att.data}`}
                            alt="preview" 
                            className="w-16 h-16 object-cover rounded-md border border-slate-200"
                        />
                        <button 
                            onClick={() => removeAttachment(idx)}
                            className="absolute -top-1 -right-1 bg-gray-900 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
        )}

      <div className="relative flex items-end gap-2 bg-white border border-slate-200 rounded-xl shadow-sm p-3 focus-within:ring-2 focus-within:ring-yellow-400/50 focus-within:border-yellow-400 transition-all">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Subir imagen"
          disabled={disabled}
        >
          <ImageIcon size={20} />
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*"
          />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe a Antelito..."
          className="flex-1 max-h-[200px] py-2 bg-transparent border-0 focus:ring-0 resize-none text-slate-900 placeholder:text-slate-400 leading-relaxed"
          rows={1}
          disabled={disabled}
        />

        <button
          onClick={handleSend}
          disabled={(!text.trim() && attachments.length === 0) || disabled}
          className={`p-2 rounded-lg mb-0.5 transition-all ${
            (text.trim() || attachments.length > 0) && !disabled
              ? 'bg-yellow-400 text-yellow-900 shadow-md hover:bg-yellow-500'
              : 'bg-slate-100 text-slate-300 cursor-not-allowed'
          }`}
        >
          <Send size={18} />
        </button>
      </div>
      <div className="text-center mt-2">
         <p className="text-xs text-slate-400">
             Antelito puede cometer errores. Verifica la información importante.
         </p>
      </div>
    </div>
  );
};

export default ChatInput;