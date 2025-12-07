import React from 'react';
import { Message, Role } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { User, Loader2 } from 'lucide-react';
import Mascot from './Mascot';

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`group w-full flex gap-3 p-3 md:gap-4 md:p-4 md:px-8 ${isUser ? 'bg-transparent' : 'bg-yellow-50/50 border-y border-yellow-100/50'}`}>
      <div className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${isUser ? 'bg-slate-200' : 'bg-transparent'}`}>
        {isUser ? (
            <User className="text-slate-600 w-4 h-4 md:w-5 md:h-5" />
        ) : (
            <Mascot size={40} className="w-8 h-8 md:w-10 md:h-10" />
        )}
      </div>
      
      <div className="flex-1 min-w-0 overflow-hidden pt-0.5">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-xs md:text-sm text-slate-900">
            {isUser ? 'Tú' : 'Antelito'}
          </span>
          <span className="text-[10px] md:text-xs text-slate-400">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Attachments rendering */}
        {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
                {message.attachments.map((att, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 shadow-sm w-32 md:w-48 h-auto">
                        <img 
                            src={`data:${att.mimeType};base64,${att.data}`} 
                            alt="attachment" 
                            className="w-full h-auto object-cover"
                        />
                    </div>
                ))}
            </div>
        )}

        {message.isThinking ? (
          <div className="flex items-center gap-2 text-slate-500 animate-pulse mt-1">
            <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
            <span className="text-xs md:text-sm">Pensando...</span>
          </div>
        ) : (
          <div className="text-slate-700 leading-relaxed text-sm md:text-base">
             <MarkdownRenderer content={message.text} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;