import React, { useState, useEffect, useRef } from 'react';
import { TrainingDatabase, SourceDocument, Message, Role } from '../types';
import { 
  loadTrainingDatabases, 
  saveTrainingDatabases 
} from '../services/storageService';
import { 
  generateTrainingComparison, 
  createTrainingChatSession,
  sendMessageStream 
} from '../services/geminiService';
import { extractTextFromPDF } from '../services/pdfService';
import { 
  Database, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  BookOpen, 
  GitCompare, 
  MessageSquare, 
  CheckCircle, 
  AlertTriangle, 
  Sparkles, 
  Loader2, 
  X,
  FileCheck,
  ChevronRight,
  HelpCircle,
  Award
} from 'lucide-react';
import { GenerateContentResponse, Chat } from '@google/genai';
import MarkdownRenderer from './MarkdownRenderer';

const TrainingManager: React.FC = () => {
  // DB States
  const [databases, setDatabases] = useState<TrainingDatabase[]>([]);
  const [selectedDbId, setSelectedDbId] = useState<string>('');
  const [targetDbId, setTargetDbId] = useState<string>('');
  
  // Modals & Forms
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [newDbDescription, setNewDbDescription] = useState('');
  
  // Processing States
  const [isUploading, setIsUploading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Active Option Tab
  const [activeTab, setActiveTab] = useState<'view' | 'compare' | 'chat'>('view');
  
  // AI Comparisons & Reports
  const [report, setReport] = useState<{
    summary: string;
    differences: Array<{ point: string; dbAVal: string; dbBVal: string; explanation: string }>;
    learningPath: Array<{ step: string; title: string; content: string }>;
    quiz: Array<{ question: string; options: string[]; correctIndex: number; explanation: string }>;
  } | null>(null);
  
  // Interactive Quiz States
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Chatbot State
  const [trainingChat, setTrainingChat] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load databases on mount
  useEffect(() => {
    const init = async () => {
      const dbs = await loadTrainingDatabases();
      setDatabases(dbs);
      if (dbs.length > 0) {
        setSelectedDbId(dbs[0].id);
      }
    };
    init();
  }, []);

  // Save databases on change
  const updateDatabases = async (updatedDbs: TrainingDatabase[]) => {
    setDatabases(updatedDbs);
    await saveTrainingDatabases(updatedDbs);
  };

  const selectedDb = databases.find(db => db.id === selectedDbId);
  const targetDb = databases.find(db => db.id === targetDbId);

  // Handle DB Creation
  const handleCreateDatabase = () => {
    if (!newDbName.trim()) return;
    
    const newDb: TrainingDatabase = {
      id: 'tdb-' + Date.now().toString(),
      name: newDbName.trim(),
      description: newDbDescription.trim() || 'Sin descripción',
      createdAt: Date.now(),
      documents: []
    };

    const updated = [...databases, newDb];
    updateDatabases(updated);
    setSelectedDbId(newDb.id);
    
    setNewDbName('');
    setNewDbDescription('');
    setShowCreateModal(false);
  };

  // Handle DB Deletion
  const handleDeleteDatabase = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de que deseas eliminar esta Base de Datos de Capacitación? Todos sus archivos se perderán.')) return;
    
    const updated = databases.filter(db => db.id !== id);
    updateDatabases(updated);
    
    if (selectedDbId === id) {
      setSelectedDbId(updated.length > 0 ? updated[0].id : '');
    }
  };

  // Upload training documents to current DB
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedDbId) return;
    
    setIsUploading(true);
    const files = Array.from(e.target.files);
    
    const parsedPromises = files.map(async (file) => {
      try {
        let content = '';
        const type = file.name.split('.').pop()?.toLowerCase() || 'txt';
        
        if (type === 'pdf') {
          content = await extractTextFromPDF(file);
        } else {
          content = await file.text();
        }

        return {
          id: 'sdoc-' + Date.now().toString() + '-' + Math.random().toString().slice(2, 6),
          name: file.name,
          type: type,
          content: content,
          isSelected: true
        } as SourceDocument;
      } catch (err) {
        console.error('Error processing file', file.name, err);
        return null;
      }
    });

    const results = (await Promise.all(parsedPromises)).filter(Boolean) as SourceDocument[];
    
    if (results.length > 0) {
      const updated = databases.map(db => {
        if (db.id === selectedDbId) {
          return { ...db, documents: [...db.documents, ...results] };
        }
        return db;
      });
      updateDatabases(updated);
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Remove a document from selected DB
  const handleDeleteFile = (docId: string) => {
    if (!selectedDbId) return;
    
    const updated = databases.map(db => {
      if (db.id === selectedDbId) {
        return { ...db, documents: db.documents.filter(doc => doc.id !== docId) };
      }
      return db;
    });
    updateDatabases(updated);
  };

  // Compare Selected DB vs Another DB
  const handleCompare = async () => {
    if (!selectedDb || !targetDb) return;
    
    setIsComparing(true);
    setReport(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    
    const dbAContent = selectedDb.documents.map(d => `--- ${d.name} ---\n${d.content}`).join('\n\n');
    const dbBContent = targetDb.documents.map(d => `--- ${d.name} ---\n${d.content}`).join('\n\n');
    
    try {
      const data = await generateTrainingComparison(
        selectedDb.name,
        dbAContent,
        targetDb.name,
        dbBContent
      );
      setReport(data);
    } catch (err) {
      console.error(err);
      alert('Error al comparar las bases de datos.');
    } finally {
      setIsComparing(false);
    }
  };

  // Initialize Training AI chatbot
  const handleInitializeChat = () => {
    if (!selectedDb) return;
    
    const dbContent = selectedDb.documents.map(d => `--- Documento: ${d.name} ---\n${d.content}`).join('\n\n');
    const session = createTrainingChatSession(selectedDb.name, dbContent);
    setTrainingChat(session);
    
    setChatMessages([
      {
        id: 'welcome',
        role: Role.MODEL,
        text: `¡Hola! Soy tu **Agente de Capacitación de Personal** para la base de datos **"${selectedDb.name}"**. 

He analizado los **${selectedDb.documents.length} documentos** cargados. Estoy listo para:
* Explicarte cualquier procedimiento, tarifa o normativa en detalle.
* Realizar cuestionarios simulados de práctica para evaluar tu conocimiento.
* Diseñar resúmenes ejecutivos adaptados a diferentes roles del personal.

¿De qué tema te gustaría recibir capacitación hoy?`,
        timestamp: Date.now()
      }
    ]);
  };

  // Restart chat if selected DB changes
  useEffect(() => {
    if (activeTab === 'chat' && selectedDbId) {
      handleInitializeChat();
    }
  }, [selectedDbId, activeTab]);

  // Scroll to bottom in training chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Send training chat message
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !trainingChat || isChatLoading) return;
    
    const userMsgText = chatInput;
    setChatInput('');
    
    const userMessage: Message = {
      id: 'usr-' + Date.now().toString(),
      role: Role.USER,
      text: userMsgText,
      timestamp: Date.now()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      const botMessageId = 'bot-' + (Date.now() + 1).toString();
      setChatMessages(prev => [
        ...prev,
        {
          id: botMessageId,
          role: Role.MODEL,
          text: '',
          timestamp: Date.now(),
          isThinking: true
        }
      ]);

      const stream = await sendMessageStream(trainingChat, userMsgText);
      let fullText = '';
      
      for await (const chunk of stream) {
        const contentResponse = chunk as GenerateContentResponse;
        fullText += contentResponse.text || '';
        
        setChatMessages(prev => 
          prev.map(msg => 
            msg.id === botMessageId 
              ? { ...msg, text: fullText, isThinking: false }
              : msg
          )
        );
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [
        ...prev,
        {
          id: 'err-' + Date.now().toString(),
          role: Role.MODEL,
          text: 'Disculpa, tuve un inconveniente al responder tu pregunta de capacitación. Intenta de nuevo por favor.',
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Submit Interactive Quiz
  const handleSubmitQuiz = () => {
    if (!report || !report.quiz) return;
    
    let score = 0;
    report.quiz.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctIndex) {
        score += 1;
      }
    });

    setQuizScore(score);
    setQuizSubmitted(true);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-slate-50 text-slate-800 overflow-hidden">
      
      {/* LEFT COLUMN: Database Selector & Document List */}
      <div className="w-full lg:w-[350px] shrink-0 bg-white border-r border-slate-200 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="text-blue-600" size={18} />
            <span className="font-bold text-slate-800 text-sm uppercase tracking-wide">Bases de Capacitación</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm shadow-blue-100"
            title="Crear Nueva Base de Datos"
          >
            <Plus size={14} />
            <span>Nueva</span>
          </button>
        </div>

        {/* Database List */}
        <div className="p-3 space-y-1.5 overflow-y-auto max-h-[220px] lg:max-h-none lg:flex-1 border-b border-slate-100 lg:border-b-0">
          {databases.length === 0 ? (
            <div className="text-center p-6 text-slate-400">
              <p className="text-xs">No hay bases de datos creadas.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 text-xs text-blue-600 underline font-medium"
              >
                Crea la primera ahora
              </button>
            </div>
          ) : (
            databases.map(db => (
              <div
                key={db.id}
                onClick={() => setSelectedDbId(db.id)}
                className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedDbId === db.id 
                    ? 'bg-blue-50/80 border-blue-400 shadow-sm' 
                    : 'bg-slate-50/60 border-transparent hover:bg-slate-100/80'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <p className={`text-sm font-semibold truncate ${selectedDbId === db.id ? 'text-blue-900' : 'text-slate-700'}`}>
                    {db.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{db.description}</p>
                  <p className="text-[10px] text-blue-600 font-bold mt-1 bg-blue-100/50 inline-block px-1.5 py-0.5 rounded">
                    {db.documents.length} {db.documents.length === 1 ? 'archivo' : 'archivos'}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteDatabase(db.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                  title="Eliminar Base de Datos"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Current Database Documents */}
        {selectedDb && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30 border-t border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Archivos en base actual</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                disabled={isUploading}
              >
                <Plus size={12} />
                Subir
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {selectedDb.documents.length === 0 ? (
                <div className="text-center p-6 border border-dashed border-slate-200 rounded-xl bg-white flex flex-col items-center justify-center h-full min-h-[140px]">
                  <Upload className="text-slate-300 mb-1.5" size={24} />
                  <p className="text-xs text-slate-400 font-medium">No hay archivos aún</p>
                  <p className="text-[10px] text-slate-400 mt-1">Sube PDFs o archivos de texto para capacitar a tu personal.</p>
                </div>
              ) : (
                selectedDb.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 shadow-sm text-xs">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <FileText className="text-slate-400 shrink-0" size={14} />
                      <span className="font-medium text-slate-700 truncate" title={doc.name}>
                        {doc.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(doc.id)}
                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-all"
                      title="Eliminar archivo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUploadFiles}
              className="hidden"
              accept=".pdf,.txt,.md,.csv"
              multiple
            />
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: AI Agent Workspace */}
      <div className="flex-1 flex flex-col h-full bg-white relative">
        {!selectedDb ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
            <Sparkles className="text-blue-500 mb-4 animate-pulse" size={48} />
            <h2 className="text-xl font-bold text-slate-800">Agente IA de Capacitación Corporativa</h2>
            <p className="text-slate-500 mt-2 text-sm max-w-md">
              Crea o selecciona una Base de Datos de Capacitación a la izquierda para comenzar a subir manuales, instructivos y procedimientos de personal.
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Tab Menu Header */}
            <div className="border-b border-slate-200 bg-slate-50/50 p-2 md:p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1 md:gap-1.5">
                <button
                  onClick={() => setActiveTab('view')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'view' 
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-100' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <BookOpen size={13} />
                  <span>Base de Conocimientos</span>
                </button>
                <button
                  onClick={() => setActiveTab('compare')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'compare' 
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-100' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <GitCompare size={13} />
                  <span>Comparador IA de DBs</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('chat');
                    handleInitializeChat();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'chat' 
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-100' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare size={13} />
                  <span>Tutor de Personal IA</span>
                </button>
              </div>

              {/* Quick statistics for active DB */}
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                <Sparkles className="text-amber-500" size={12} />
                <span>Base Activa: <strong className="text-slate-800">{selectedDb.name}</strong></span>
              </div>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
              
              {/* TAB 1: VIEW / GENERAL DB DASHBOARD */}
              {activeTab === 'view' && (
                <div className="space-y-6">
                  {/* Banner/Dashboard card */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 md:p-6 text-white shadow-md relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Sparkles className="text-yellow-300" size={20} />
                      Panel de Capacitación IA
                    </h3>
                    <p className="text-blue-100 text-xs md:text-sm mt-1.5 max-w-2xl leading-relaxed">
                      Este espacio te permite centralizar el material de capacitación corporativo. Nuestro Agente Inteligente procesa todo el contenido textual para instruir, evaluar y guiar al personal en sus procesos de aprendizaje de manera automatizada.
                    </p>

                    {/* Stats boxes in the banner */}
                    <div className="grid grid-cols-3 gap-3 mt-5">
                      <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-blue-200 font-bold uppercase">Archivos Cargados</p>
                        <p className="text-xl md:text-2xl font-black mt-0.5">{selectedDb.documents.length}</p>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-blue-200 font-bold uppercase">Estado de DB</p>
                        <p className="text-xs md:text-sm font-black mt-1.5 flex items-center gap-1">
                          <CheckCircle className="text-emerald-300 shrink-0" size={14} />
                          {selectedDb.documents.length > 0 ? 'Lista para IA' : 'Vacia'}
                        </p>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
                        <p className="text-[10px] text-blue-200 font-bold uppercase">Capacidad Usada</p>
                        <p className="text-xl md:text-2xl font-black mt-0.5">
                          {(selectedDb.documents.reduce((acc, curr) => acc + curr.content.length, 0) / 1000).toFixed(1)}k <span className="text-xs font-normal">chars</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Manual / Steps to proceed */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 hover:shadow-md transition-all">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs mb-3">1</div>
                      <h4 className="font-bold text-slate-800 text-sm">Sube instructivos de personal</h4>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        Carga documentos (PDF, TXT, MD, CSV) referidos a políticas internas, guías de sistemas, tarifas vigentes u onboarding de nuevos ingresos.
                      </p>
                    </div>

                    <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 hover:shadow-md transition-all">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs mb-3">2</div>
                      <h4 className="font-bold text-slate-800 text-sm">Chatea con el Tutor Corporativo</h4>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        Accede a la sección de "Tutor de Personal IA" para interactuar de forma conversacional con el material de entrenamiento. Ideal para que los empleados se preparen de forma libre.
                      </p>
                    </div>

                    <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 hover:shadow-md transition-all">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs mb-3">3</div>
                      <h4 className="font-bold text-slate-800 text-sm">Compara bases de datos e instructivos</h4>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        Usa la pestaña de "Comparador IA" para contrastar bases de datos completas, detectar cambios en tarifas o políticas, y generar cuestionarios interactivos de evaluación instantáneos.
                      </p>
                    </div>

                    <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 hover:shadow-md transition-all flex flex-col justify-between">
                      <div>
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs mb-3">
                          <Award size={14} />
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm">Evaluación Interactiva</h4>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                          Nuestra IA genera cuestionarios con justificaciones automáticas para evaluar la efectividad de las lecturas. ¡Prueba comparando tus manuales ahora!
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Document database structure view */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <div className="p-4 border-b border-slate-200 bg-slate-50/40">
                      <h4 className="font-bold text-sm text-slate-800">Detalles de la Base de Datos</h4>
                    </div>
                    <div className="p-4 text-xs space-y-3">
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-400 font-medium">Nombre corporativo:</span>
                        <span className="text-slate-800 font-bold">{selectedDb.name}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-400 font-medium">Descripción técnica:</span>
                        <span className="text-slate-700 max-w-xs text-right truncate">{selectedDb.description}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-400 font-medium">Archivos cargados:</span>
                        <span className="text-slate-800 font-bold">{selectedDb.documents.length}</span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="text-slate-400 font-medium">Fecha de creación:</span>
                        <span className="text-slate-700">{new Date(selectedDb.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: COMPARE DATABASES & GENERATE EVALUATION */}
              {activeTab === 'compare' && (
                <div className="space-y-6">
                  {/* Selector setup */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5">
                    <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2 mb-3">
                      <GitCompare className="text-blue-600" size={18} />
                      Configuración de Comparación de Bases de Datos
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Source DB (Selected) */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Base de Datos Principal A (Base)</label>
                        <div className="flex items-center gap-2 p-2 bg-blue-50/50 rounded-lg">
                          <Database className="text-blue-500" size={16} />
                          <span className="text-xs font-bold text-blue-900">{selectedDb.name}</span>
                          <span className="text-[10px] text-blue-600 ml-auto bg-blue-100 px-1.5 py-0.5 rounded">
                            {selectedDb.documents.length} archs
                          </span>
                        </div>
                      </div>

                      {/* Target DB */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Base de Datos de Contraste B (Nueva / Actualización)</label>
                        <div className="flex items-center gap-2">
                          <Database className="text-slate-400 shrink-0" size={16} />
                          <select
                            value={targetDbId}
                            onChange={(e) => setTargetDbId(e.target.value)}
                            className="w-full text-xs font-medium text-slate-700 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
                          >
                            <option value="">-- Selecciona base B --</option>
                            {databases.filter(db => db.id !== selectedDb.id).map(db => (
                              <option key={db.id} value={db.id}>
                                {db.name} ({db.documents.length} archivos)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Launch Compare Button */}
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleCompare}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
                        disabled={isComparing || !selectedDbId || !targetDbId || selectedDb.documents.length === 0 || (targetDb && targetDb.documents.length === 0)}
                      >
                        {isComparing ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Analizando Bases por IA...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} className="text-yellow-300" />
                            <span>Iniciar Comparación por IA</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Safety notice */}
                    {(!targetDbId || (targetDb && targetDb.documents.length === 0) || selectedDb.documents.length === 0) && (
                      <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1.5 font-medium">
                        <AlertTriangle size={12} />
                        Ambas bases de datos de capacitación deben contener al menos un archivo subido para proceder.
                      </p>
                    )}
                  </div>

                  {/* COMPARISON REPORT CONTAINER */}
                  {report && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                      
                      {/* Summary card */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <h4 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2 border-b border-slate-100 pb-3">
                          <BookOpen className="text-indigo-500" size={18} />
                          Análisis Comparativo General por IA
                        </h4>
                        <div className="mt-3 prose prose-slate max-w-none text-xs md:text-sm leading-relaxed text-slate-600">
                          <MarkdownRenderer content={report.summary} />
                        </div>
                      </div>

                      {/* Side-by-Side Differences */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <h4 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                          <GitCompare className="text-rose-500" size={18} />
                          Diferencias Clave y Actualizaciones de Normativa
                        </h4>
                        
                        {report.differences.length === 0 ? (
                          <div className="text-center p-6 text-slate-400 text-xs">
                            No se detectaron diferencias conceptuales o actualizaciones explícitas entre ambos conjuntos de información.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left text-slate-500 border-collapse">
                              <thead>
                                <tr className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-100">
                                  <th className="py-3 px-4 font-black">Tema o Aspecto</th>
                                  <th className="py-3 px-4 font-black bg-blue-50/20">{selectedDb.name} (Base A)</th>
                                  <th className="py-3 px-4 font-black bg-indigo-50/20">{targetDb?.name} (Base B)</th>
                                  <th className="py-3 px-4 font-black">Impacto en la Capacitación</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {report.differences.map((diff, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3.5 px-4 font-bold text-slate-800">{diff.point}</td>
                                    <td className="py-3.5 px-4 bg-blue-50/10 text-slate-600 italic">{diff.dbAVal}</td>
                                    <td className="py-3.5 px-4 bg-indigo-50/10 text-indigo-900 font-semibold">{diff.dbBVal}</td>
                                    <td className="py-3.5 px-4 text-slate-500">{diff.explanation}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Suggested Learning Path */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <h4 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                          <ChevronRight className="text-emerald-500" size={18} />
                          Ruta de Aprendizaje Recomendada para el Personal
                        </h4>
                        
                        <div className="relative border-l border-blue-200 ml-3 space-y-6 py-2">
                          {report.learningPath.map((path, idx) => (
                            <div key={idx} className="relative pl-6">
                              {/* marker */}
                              <div className="absolute -left-2.5 top-1 w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[10px] flex items-center justify-center border-2 border-white shadow">
                                {idx + 1}
                              </div>
                              <h5 className="font-bold text-slate-800 text-xs md:text-sm">{path.title} <span className="text-[10px] text-blue-600 font-bold uppercase bg-blue-50 px-1 rounded ml-1.5">{path.step}</span></h5>
                              <p className="text-slate-500 text-xs mt-1 leading-relaxed">{path.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Interactive Evaluation Quiz */}
                      <div className="bg-slate-900 text-white rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                        
                        <h4 className="font-bold text-sm md:text-base flex items-center gap-2 border-b border-white/10 pb-3 mb-5">
                          <HelpCircle className="text-yellow-400" size={18} />
                          Evaluación de Comprensión del Personal
                        </h4>

                        <div className="space-y-6">
                          {report.quiz.map((q, qIdx) => (
                            <div key={qIdx} className="space-y-2 border-b border-white/5 pb-4 last:border-b-0">
                              <p className="text-xs md:text-sm font-bold text-slate-100 flex gap-2">
                                <span className="text-indigo-400">{qIdx + 1}.</span>
                                {q.question}
                              </p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                {q.options.map((opt, oIdx) => {
                                  const isSelected = quizAnswers[qIdx] === oIdx;
                                  const isCorrect = q.correctIndex === oIdx;
                                  
                                  let btnClass = 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300';
                                  
                                  if (quizSubmitted) {
                                    if (isCorrect) {
                                      btnClass = 'bg-emerald-600/30 border-emerald-500 text-emerald-200';
                                    } else if (isSelected) {
                                      btnClass = 'bg-rose-600/30 border-rose-500 text-rose-200';
                                    } else {
                                      btnClass = 'bg-white/5 border-white/10 opacity-50';
                                    }
                                  } else if (isSelected) {
                                    btnClass = 'bg-indigo-600/50 border-indigo-500 text-white font-bold ring-2 ring-indigo-500/20';
                                  }

                                  return (
                                    <button
                                      key={oIdx}
                                      onClick={() => {
                                        if (quizSubmitted) return;
                                        setQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
                                      }}
                                      className={`text-left p-3 rounded-xl border text-xs transition-all ${btnClass}`}
                                      disabled={quizSubmitted}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Explanation show */}
                              {quizSubmitted && (
                                <div className="mt-2 text-[10px] text-slate-400 bg-white/5 p-2 rounded-lg leading-relaxed flex gap-1 items-start">
                                  <Sparkles className="text-indigo-400 shrink-0" size={12} />
                                  <span>{q.explanation}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Quiz Controls & Score */}
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                          {quizSubmitted ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
                                {quizScore}/4
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-100">Evaluación Finalizada</p>
                                <p className="text-[10px] text-slate-400">
                                  {quizScore === 4 
                                    ? '¡Excelente! Comprensión perfecta de las diferencias.' 
                                    : 'Te sugerimos repasar el material con el Tutor de Personal.'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">Completa las respuestas arriba para evaluar el aprendizaje.</p>
                          )}

                          {!quizSubmitted ? (
                            <button
                              onClick={handleSubmitQuiz}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow transition-all active:scale-95"
                              disabled={Object.keys(quizAnswers).length < report.quiz.length}
                            >
                              Finalizar Evaluación
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setQuizAnswers({});
                                setQuizSubmitted(false);
                                setQuizScore(0);
                              }}
                              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl font-bold text-xs transition-all"
                            >
                              Reintentar Cuestionario
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: STAFF INTERACTIVE TUTOR CHAT */}
              {activeTab === 'chat' && (
                <div className="flex flex-col h-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden min-h-[450px]">
                  {/* Messages list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                    {chatMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-[85%] ${
                          msg.role === Role.USER ? 'ml-auto flex-row-reverse' : 'mr-auto'
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 font-bold select-none ${
                          msg.role === Role.USER 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {msg.role === Role.USER ? 'U' : 'T'}
                        </div>
                        
                        {/* Box content */}
                        <div className={`p-3 rounded-2xl text-xs md:text-sm leading-relaxed ${
                          msg.role === Role.USER 
                            ? 'bg-blue-600 text-white rounded-tr-none shadow-sm shadow-blue-100' 
                            : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50'
                        }`}>
                          {msg.isThinking ? (
                            <div className="flex items-center gap-2 text-slate-500 py-1 font-medium">
                              <Loader2 className="animate-spin" size={14} />
                              <span>Analizando manuales de capacitación...</span>
                            </div>
                          ) : (
                            <div className="prose prose-sm max-w-none">
                              <MarkdownRenderer content={msg.text} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Message Input area */}
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendChatMessage();
                      }}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs md:text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all shadow-sm"
                      placeholder="Pregunta sobre tarifas, procedimientos, u onboarding..."
                      disabled={isChatLoading || !trainingChat}
                    />
                    <button
                      onClick={handleSendChatMessage}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md flex items-center gap-1 active:scale-95 disabled:bg-slate-300 disabled:shadow-none"
                      disabled={isChatLoading || !chatInput.trim() || !trainingChat}
                    >
                      {isChatLoading ? <Loader2 size={12} className="animate-spin" /> : 'Preguntar'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* MODAL: CREATE NEW DATABASE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Database size={16} className="text-blue-600" />
                Nueva Base de Capacitación
              </h4>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Nombre corporativo</label>
                <input
                  type="text"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  placeholder="Ej: Manual de Ventas 2024, Tarificaciones v3"
                  className="w-full text-xs md:text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 shadow-sm"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Descripción del propósito</label>
                <textarea
                  value={newDbDescription}
                  onChange={(e) => setNewDbDescription(e.target.value)}
                  placeholder="Ej: Material de onboarding y especificaciones técnicas para ejecutivos comerciales de ventas."
                  rows={3}
                  className="w-full text-xs md:text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 shadow-sm resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateDatabase}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-md active:scale-95"
                disabled={!newDbName.trim()}
              >
                Crear Base de Datos
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TrainingManager;
