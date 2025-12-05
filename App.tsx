import React, { useState, useRef, useEffect } from 'react';
import { Message, Role, Attachment, SourceDocument } from './types';
import MessageItem from './components/MessageItem';
import ChatInput from './components/ChatInput';
import Mascot from './components/Mascot';
import LibrarySidebar from './components/LibrarySidebar';
import { createChatSession, sendMessageStream } from './services/geminiService';
import { extractTextFromPDF } from './services/pdfService';
import { saveLibrary, loadLibrary, exportLibrary } from './services/storageService';
import { GenerateContentResponse, Chat } from '@google/genai';
import { Menu, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  // Application State
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingDocs, setIsProcessingDocs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Library on Mount
  useEffect(() => {
      const initLibrary = async () => {
          const docs = await loadLibrary();
          setDocuments(docs);
      };
      initLibrary();
  }, []);

  // Save Library on Change
  useEffect(() => {
      if (documents.length > 0) {
          saveLibrary(documents);
      }
  }, [documents]);
  
  // Initialize Chat Session when documents change
  useEffect(() => {
    // Only restart chat if we have documents or if it's the first load
    startNewChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]); 

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewChat = () => {
    const selectedDocs = documents.filter(d => d.isSelected);
    const contextText = selectedDocs.map(d => `--- Documento: ${d.name} (${d.type}) ---\n${d.content}\n`).join('\n');
    
    const newChat = createChatSession(contextText);
    setChatSession(newChat);
    
    if (messages.length > 0) {
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: Role.MODEL,
            text: `_Contexto actualizado. ${selectedDocs.length} documentos activos._`,
            timestamp: Date.now(),
        }]);
    } else {
        setMessages([]);
    }
    setIsLoading(false);
  };

  const handleResetChat = () => {
      setMessages([]);
      startNewChat();
  };

  const handleAddDocument = async (files: FileList) => {
    setIsProcessingDocs(true);
    
    // Process files in parallel
    const filePromises = Array.from(files).map(async (file) => {
        try {
            let content = '';
            const type = file.name.split('.').pop()?.toLowerCase() || 'txt';
            
            if (type === 'pdf') {
                content = await extractTextFromPDF(file);
            } else {
                content = await file.text();
            }

            return {
                id: Date.now().toString() + Math.random().toString(),
                name: file.name,
                type: type,
                content: content,
                isSelected: true
            } as SourceDocument;
        } catch (err) {
            console.error("Error processing file", file.name, err);
            return null;
        }
    });

    const newDocs = (await Promise.all(filePromises)).filter(Boolean) as SourceDocument[];
    
    setDocuments(prev => [...prev, ...newDocs]);
    setIsProcessingDocs(false);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(prev => {
        const newDocs = prev.filter(d => d.id !== id);
        // If list empty, clear storage
        if (newDocs.length === 0) {
            // We can trigger a clear in storageService, but saveLibrary handles empty array
            saveLibrary([]); 
        }
        return newDocs;
    });
  };

  const handleToggleDocument = (id: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, isSelected: !d.isSelected } : d));
  };

  const handleExportLibrary = () => {
      exportLibrary(documents);
  };

  const handleImportLibrary = async (file: File) => {
      try {
          const text = await file.text();
          const importedDocs = JSON.parse(text) as SourceDocument[];
          // Validate basic structure
          if (Array.isArray(importedDocs) && importedDocs.every(d => d.id && d.content)) {
              setDocuments(prev => [...prev, ...importedDocs]);
          } else {
              alert("Archivo de backup inválido.");
          }
      } catch (e) {
          console.error(e);
          alert("Error al importar la biblioteca.");
      }
  };

  const handleSendMessage = async (text: string, attachments: Attachment[]) => {
    if (!chatSession) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text,
      attachments,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const botMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        {
          id: botMessageId,
          role: Role.MODEL,
          text: '',
          timestamp: Date.now(),
          isThinking: true,
        },
      ]);

      const stream = await sendMessageStream(chatSession, text, attachments);
      
      let fullText = '';

      for await (const chunk of stream) {
        const contentResponse = chunk as GenerateContentResponse;
        const chunkText = contentResponse.text || '';
        fullText += chunkText;

        setMessages((prev) => 
            prev.map((msg) => 
                msg.id === botMessageId 
                ? { ...msg, text: fullText, isThinking: false } 
                : msg
            )
        );
      }

    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: Role.MODEL,
          text: "Lo siento, hubo un error al procesar tu solicitud. Asegúrate de que tu API Key sea válida.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar - Library */}
      <div 
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full absolute'} md:relative md:translate-x-0 z-20 transition-transform duration-300 ease-in-out h-full flex-shrink-0 shadow-xl md:shadow-none`}
      >
        <LibrarySidebar 
            documents={documents}
            onAddDocument={handleAddDocument}
            onRemoveDocument={handleRemoveDocument}
            onToggleDocument={handleToggleDocument}
            onExportLibrary={handleExportLibrary}
            onImportLibrary={handleImportLibrary}
            isProcessing={isProcessingDocs}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative w-full bg-white md:rounded-l-2xl md:my-2 md:mr-2 md:shadow-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden"
             >
                <Menu size={20} />
             </button>
             
             <div className="flex items-center gap-3">
                 <Mascot size={32} />
                 <div>
                     <h1 className="font-bold text-slate-800 text-lg leading-tight">Antelito 3.0</h1>
                     <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                         {documents.filter(d => d.isSelected).length > 0 ? 'Modo: Investigación' : 'Esperando Documentos'}
                     </p>
                 </div>
             </div>
          </div>
          
          <button 
            onClick={handleResetChat}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            title="Reiniciar chat"
          >
            <RefreshCw size={18} />
          </button>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth bg-white">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
               <div className="mb-6 opacity-80">
                  <Mascot size={100} />
               </div>
               <h2 className="text-2xl font-bold text-slate-800 mb-2">Tu Biblioteca Personal</h2>
               <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
                 Arrastra tus archivos PDF, TXT o MD en la barra lateral. Antelito leerá todo y responderá tus dudas basándose en ellos.
               </p>
               
               {documents.length === 0 && (
                   <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-sm text-sm text-yellow-800 animate-bounce">
                       👈 ¡Arrastra archivos aquí para empezar!
                   </div>
               )}
            </div>
          ) : (
            <div className="flex flex-col pb-4">
              {messages.map((msg) => (
                <MessageItem key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          <ChatInput onSend={handleSendMessage} disabled={isLoading} />
        </div>
      </div>
      
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/20 z-10 md:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default App;