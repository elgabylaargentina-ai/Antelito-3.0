import React, { useRef, useState } from 'react';
import { SourceDocument } from '../types';
import { FileText, Upload, Trash2, FileCheck, Info, Download, Archive, Loader2, Lock } from 'lucide-react';

interface LibrarySidebarProps {
  documents: SourceDocument[];
  onAddDocument: (files: FileList) => void;
  onRemoveDocument: (id: string) => void;
  onToggleDocument: (id: string) => void;
  onExportLibrary: () => void;
  onImportLibrary: (file: File) => void;
  isProcessing: boolean;
}

const LibrarySidebar: React.FC<LibrarySidebarProps> = ({ 
  documents, 
  onAddDocument, 
  onRemoveDocument,
  onToggleDocument,
  onExportLibrary,
  onImportLibrary,
  isProcessing
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddDocument(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          onImportLibrary(e.target.files[0]);
      }
      if (importInputRef.current) importInputRef.current.value = '';
  };

  const onDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onAddDocument(e.dataTransfer.files);
      }
  };

  return (
    <div 
        className={`flex flex-col h-full bg-slate-50 border-r border-slate-200 w-full md:w-[320px] transition-colors ${isDragging ? 'bg-yellow-50 border-yellow-400' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
    >
      <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-sm">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 flex items-center gap-2">
          <FileText size={16} className="text-yellow-500" />
          Biblioteca
        </h2>
        <div className="flex justify-between items-end">
            <p className="text-xs text-slate-500">
            {documents.filter(d => d.isSelected).length} seleccionados
            </p>
            {documents.length > 0 && (
                <div className="flex gap-1">
                    <button 
                        onClick={onExportLibrary}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                        title="Exportar copia de seguridad"
                    >
                        <Download size={14} />
                    </button>
                </div>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
        {isDragging && (
            <div className="absolute inset-0 z-10 bg-yellow-100/80 border-2 border-dashed border-yellow-400 m-2 rounded-xl flex items-center justify-center pointer-events-none">
                <div className="text-center text-yellow-700">
                    <Upload size={40} className="mx-auto mb-2 animate-bounce" />
                    <p className="font-bold">¡Suelta los archivos aquí!</p>
                </div>
            </div>
        )}

        {isProcessing && (
           <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-100 animate-pulse">
               <Loader2 size={16} className="animate-spin" />
               <span>Procesando documentos...</span>
           </div>
        )}

        {documents.length === 0 && !isProcessing ? (
          <div className="text-center p-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl h-48 flex flex-col items-center justify-center">
            <Info size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-500">Biblioteca vacía</p>
            <p className="text-xs mt-1">Arrastra tus archivos aquí</p>
            <p className="text-[10px] mt-2 opacity-70">PDF, TXT, MD, CSV</p>
            
            <button 
                onClick={() => importInputRef.current?.click()}
                className="mt-4 text-xs flex items-center gap-1 text-slate-400 hover:text-slate-600 underline"
            >
                <Archive size={12} />
                Importar backup
            </button>
            <input 
                type="file" 
                ref={importInputRef}
                onChange={handleImportChange}
                className="hidden"
                accept=".json"
            />
          </div>
        ) : (
          documents.map((doc) => (
            <div 
              key={doc.id}
              className={`group flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                doc.isSelected 
                  ? 'bg-white border-yellow-400 shadow-sm' 
                  : 'bg-slate-100 border-transparent hover:bg-slate-200/50'
              }`}
              onClick={() => onToggleDocument(doc.id)}
            >
              <div className={`shrink-0 ${doc.isSelected ? 'text-yellow-600' : 'text-slate-400'}`}>
                {doc.isSelected ? <FileCheck size={18} /> : <FileText size={18} />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                    <p className={`text-sm font-medium truncate ${doc.isSelected ? 'text-slate-800' : 'text-slate-500'}`}>
                    {doc.name}
                    </p>
                    {doc.readOnly && (
                        <Lock size={10} className="text-slate-400 shrink-0" />
                    )}
                </div>
                <p className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                  <span className="bg-slate-200 px-1 rounded">{doc.type}</span> 
                  <span>{(doc.content.length / 1000).toFixed(1)}k chars</span>
                  {doc.readOnly && <span className="text-amber-600 bg-amber-50 px-1 rounded ml-1">Fijo</span>}
                </p>
              </div>

              {!doc.readOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveDocument(doc.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded-md transition-all"
                    title="Eliminar fuente"
                  >
                    <Trash2 size={14} />
                  </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-slate-200 bg-white">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md transition-all font-medium text-sm active:scale-95"
          disabled={isProcessing}
        >
          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          <span>Añadir Archivos</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.txt,.md,.csv,.json,.js,.ts,.tsx,.html,.css"
          multiple
        />
      </div>
    </div>
  );
};

export default LibrarySidebar;