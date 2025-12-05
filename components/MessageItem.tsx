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
    <div className={`group w-full flex gap-4 p-4 md:px-8 ${isUser ? 'bg-transparent' : 'bg-yellow-50/50 border-y border-yellow-100/50'}`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isUser ? 'bg-slate-200' : 'bg-transparent'}`}>
        {isUser ? (
            <User size={20} className="text-slate-600" />
        ) : (
            <Mascot size={40} />
        )}
      </div>
      
      <div className="flex-1 min-w-0 overflow-hidden pt-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-slate-900">
            {isUser ? 'Tú' : 'Antelito'}
          </span>
          <span className="text-xs text-slate-400">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Attachments rendering */}
        {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
                {message.attachments.map((att, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 shadow-sm w-48 h-auto">
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
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Pensando...</span>
          </div>
        ) : (
          <div className="text-slate-700 leading-7">
             <MarkdownRenderer content={message.text} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;