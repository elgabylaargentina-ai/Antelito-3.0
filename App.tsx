import React, { useState, useRef, useEffect } from 'react';
import { Message, Role, Attachment, SourceDocument, UserRole, VisitStats } from './types';
import MessageItem from './components/MessageItem';
import ChatInput from './components/ChatInput';
import Mascot from './components/Mascot';
import LibrarySidebar from './components/LibrarySidebar';
import LoginScreen from './components/LoginScreen'; // Import login screen
import DeveloperSignature from './components/DeveloperSignature'; // Import signature
import TrainingManager from './components/TrainingManager'; // Import TrainingManager
import VisitHistoryModal from './components/VisitHistoryModal'; // Import VisitHistoryModal
import { createChatSession, sendMessageStream } from './services/geminiService';
import { extractTextFromPDF } from './services/pdfService';
import { saveLibrary, loadLibrary, exportLibrary, recordAppVisit, resetVisitStats } from './services/storageService';
import { GenerateContentResponse, Chat } from '@google/genai';
import { Menu, RefreshCw, LogOut, Eye } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  
  // Admin Navigation State
  const [adminView, setAdminView] = useState<'chat' | 'training'>('chat');

  // Application State
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingDocs, setIsProcessingDocs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [visitStats, setVisitStats] = useState<VisitStats>({ totalVisits: 0, lastVisit: Date.now(), sessionVisits: 0 });
  const [showVisitHistoryModal, setShowVisitHistoryModal] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Library & Record App Visit on Mount
  useEffect(() => {
      const initLibrary = async () => {
          const docs = await loadLibrary();
          setDocuments(docs);
          const stats = await recordAppVisit();
          setVisitStats(stats);
      };
      initLibrary();
  }, []);

  const handleResetVisits = async () => {
      const reset = await resetVisitStats();
      setVisitStats(reset);
  };

  // Save Library on Change
  useEffect(() => {
      if (documents.length > 0) {
          saveLibrary(documents);
      }
      updateSuggestions();
  }, [documents]);
  
  // Initialize Chat Session when documents change
  useEffect(() => {
    if (userRole) { // Only start chat if logged in
        startNewChat();
        updateSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, userRole]); 

  // Handle mobile sidebar state on window resize
  useEffect(() => {
    const handleResize = () => {
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        } else {
            setSidebarOpen(true);
        }
    };
    
    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const updateSuggestions = () => {
      const selectedDocs = documents.filter(d => d.isSelected);
      const newSuggestions: string[] = [];

      // Logic to generate context-aware suggestions based on filenames/content
      const hasTarifas = selectedDocs.some(d => d.name.toLowerCase().includes('tarifas'));
      const hasMarcas = selectedDocs.some(d => d.name.toLowerCase().includes('marcas'));
      const hasDemora = selectedDocs.some(d => d.name.toLowerCase().includes('demora'));
      const hasPlanes = selectedDocs.some(d => d.name.toLowerCase().includes('planes'));
      const hasMigracion = selectedDocs.some(d => d.name.toLowerCase().includes('migracion'));

      if (hasTarifas) {
          newSuggestions.push("¿Costo conexión fibra?");
          newSuggestions.push("¿Precio traslado?");
      }
      if (hasMarcas) {
          newSuggestions.push("¿Qué hago si falta el poste?");
          newSuggestions.push("Pasos para traslado");
      }
      if (hasDemora) {
          newSuggestions.push("¿Qué significa código ET?");
          newSuggestions.push("Cliente no reside (NR)");
      }
      if (hasPlanes) {
          newSuggestions.push("Diferencia Fibra Plus vs Básico");
          newSuggestions.push("Tope consumo plan flexible");
      }
      if (hasMigracion) {
          newSuggestions.push("Migración Cobre a Fibra");
          newSuggestions.push("Reclamos TLK-GDF");
      }

      // Fallback defaults if nothing specific matches or list is empty
      if (newSuggestions.length === 0) {
          if (selectedDocs.length > 0) {
              newSuggestions.push("Resumen de los documentos");
              newSuggestions.push("Puntos clave");
              newSuggestions.push("Analizar inconsistencias");
          } else {
              newSuggestions.push("¿Cómo subir archivos?");
              newSuggestions.push("¿Qué puedes hacer?");
          }
      }

      // Shuffle and limit to 4-5 to keep it clean
      setSuggestions(newSuggestions.sort(() => 0.5 - Math.random()).slice(0, 5));
  };

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
      if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleLogin = (role: UserRole) => {
      setUserRole(role);
      if (window.innerWidth >= 768) setSidebarOpen(true);
  };

  const handleLogout = () => {
      setUserRole(null);
      setMessages([]);
      // Optional: Clear temporary docs on logout? No, keep persistence for UX
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
                isSelected: true,
                readOnly: false // Uploads are always editable initially
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
        if (newDocs.length === 0) {
            saveLibrary([]); 
        }
        return newDocs;
    });
  };

  const handleToggleDocument = (id: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, isSelected: !d.isSelected } : d));
  };

  // Admin Feature: Toggle "Global/Fixed" status
  const handleToggleGlobal = (id: string) => {
      if (userRole !== 'admin') return;
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, readOnly: !d.readOnly } : d));
  };

  const handleExportLibrary = () => {
      exportLibrary(documents);
  };

  const handleImportLibrary = async (file: File) => {
      try {
          const text = await file.text();
          const importedDocs = JSON.parse(text) as SourceDocument[];
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

  // If not logged in, show Login Screen
  if (!userRole) {
      return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    // Use h-dvh (Dynamic Viewport Height) for mobile browsers to handle address bars correctly
    <div className="flex h-dvh bg-slate-50 overflow-hidden font-sans relative">
      
      <DeveloperSignature />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/40 z-20 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Library */}
      <div 
        className={`fixed md:relative inset-y-0 left-0 z-30 w-[85%] md:w-auto transform transition-transform duration-300 ease-in-out h-full shadow-2xl md:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <LibrarySidebar 
            documents={documents}
            onAddDocument={handleAddDocument}
            onRemoveDocument={handleRemoveDocument}
            onToggleDocument={handleToggleDocument}
            onExportLibrary={handleExportLibrary}
            onImportLibrary={handleImportLibrary}
            onToggleGlobal={handleToggleGlobal}
            isProcessing={isProcessingDocs}
            userRole={userRole}
            visitStats={visitStats}
            onResetVisits={handleResetVisits}
            onOpenVisitHistory={() => setShowVisitHistoryModal(true)}
            onClose={() => setSidebarOpen(false)} // Pass close handler for mobile
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative w-full bg-white md:rounded-l-2xl md:my-2 md:mr-2 md:shadow-lg overflow-hidden border-l border-slate-200">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-slate-100 bg-white/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden active:bg-slate-200"
             >
                <Menu size={24} />
             </button>
             
             <div className="flex items-center gap-2 md:gap-3">
                 <Mascot size={28} className="md:w-8 md:h-8" />
                 <div>
                     <h1 className="font-bold text-slate-800 text-base md:text-lg leading-tight">Antelito 3.0</h1>
                     <div className="flex items-center gap-1.5">
                         <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${userRole === 'admin' ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                         <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                             {userRole === 'admin' ? 'Admin' : 'Usuario'}
                         </p>
                     </div>
                 </div>
             </div>
          </div>

          {/* Admin Navigation Selector & Visit Counter */}
          {userRole === 'admin' && (
            <div className="flex items-center gap-2">
              {/* Counter Badge */}
              <button 
                onClick={() => setShowVisitHistoryModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/80 hover:bg-blue-100/90 active:scale-95 text-blue-800 border border-blue-200/80 rounded-xl text-[10px] md:text-xs font-bold shadow-sm transition-all cursor-pointer"
                title="Ver historial detallado de día y hora de visitas"
              >
                <Eye size={13} className="text-blue-600 shrink-0" />
                <span>{visitStats.totalVisits} <span className="hidden sm:inline">visitas</span></span>
              </button>

              <div className="flex bg-slate-100 p-0.5 md:p-1 rounded-xl border border-slate-200/60 scale-90 md:scale-100">
                <button
                  onClick={() => setAdminView('chat')}
                  className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${
                    adminView === 'chat' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Chat General
                </button>
                <button
                  onClick={() => setAdminView('training')}
                  className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${
                    adminView === 'training' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Agente IA
                </button>
              </div>
            </div>
          )}
          
          {/* Controls: Added right margin to avoid overlap with Developer Signature on desktop */}
          <div className="flex gap-1 md:gap-2 mr-0 md:mr-32 transition-all">
            <button 
                onClick={handleResetChat}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                title="Reiniciar chat"
            >
                <RefreshCw size={18} />
            </button>
            <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Cerrar sesión"
            >
                <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Main Workspace content */}
        {userRole === 'admin' && adminView === 'training' ? (
          <div className="flex-1 overflow-hidden h-full">
            <TrainingManager />
          </div>
        ) : (
          <>
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto scroll-smooth bg-white touch-pan-y">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 md:p-8 text-center animate-in fade-in zoom-in duration-300">
                   <div className="mb-4 md:mb-6 opacity-80">
                      <Mascot size={80} className="md:w-[100px] md:h-[100px]" />
                   </div>
                   <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">
                       {userRole === 'admin' ? 'Panel de Control' : 'Tu Biblioteca'}
                   </h2>
                   <p className="text-sm md:text-base text-slate-500 max-w-md mb-6 leading-relaxed px-4">
                     {userRole === 'admin' 
                        ? 'Gestiona la base de datos global. Los archivos con candado son visibles para todos.'
                        : 'Antelito está listo. Tus consultas se basarán en los documentos disponibles.'
                     }
                   </p>
                   
                   {documents.length === 0 && (
                       <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs md:text-sm text-yellow-800 animate-bounce">
                           👈 Sube archivos en el menú
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
            <div className="p-2 md:p-4 bg-white border-t border-slate-100">
              <ChatInput onSend={handleSendMessage} disabled={isLoading} suggestions={suggestions} />
            </div>
          </>
        )}
      </div>

      {/* Admin Visit History Modal */}
      {userRole === 'admin' && (
        <VisitHistoryModal
          isOpen={showVisitHistoryModal}
          onClose={() => setShowVisitHistoryModal(false)}
          visitStats={visitStats}
          onResetVisits={handleResetVisits}
        />
      )}
    </div>
  );
};

export default App;