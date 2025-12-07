import localforage from 'localforage';
import { SourceDocument } from '../types';

const DB_NAME = 'antelito_library';
const STORE_KEY = 'documents';

localforage.config({
  name: 'AntelitoApp',
  storeName: DB_NAME
});

export const saveLibrary = async (documents: SourceDocument[]) => {
  try {
    // Solo guardamos los documentos que NO son de solo lectura (los del usuario)
    // Los globales se cargan siempre desde el servidor
    const userDocuments = documents.filter(doc => !doc.readOnly);
    await localforage.setItem(STORE_KEY, userDocuments);
  } catch (err) {
    console.error('Error saving library:', err);
  }
};

const loadGlobalLibrary = async (): Promise<SourceDocument[]> => {
  try {
    const response = await fetch('/library.json');
    if (!response.ok) return [];
    const globalDocs: SourceDocument[] = await response.json();
    // Asegurarnos de que tengan el flag readOnly y estén seleccionados por defecto
    return globalDocs.map(doc => ({ ...doc, readOnly: true, isSelected: true }));
  } catch (error) {
    console.warn("No se pudo cargar la biblioteca global:", error);
    return [];
  }
};

export const loadLibrary = async (): Promise<SourceDocument[]> => {
  try {
    const [localDocs, globalDocs] = await Promise.all([
      localforage.getItem<SourceDocument[]>(STORE_KEY),
      loadGlobalLibrary()
    ]);
    
    const validLocalDocs = localDocs || [];
    
    // Combinar: Primero los globales (fijos), luego los del usuario
    return [...globalDocs, ...validLocalDocs];
  } catch (err) {
    console.error('Error loading library:', err);
    return [];
  }
};

export const clearLibrary = async () => {
    await localforage.removeItem(STORE_KEY);
};

export const exportLibrary = async (documents: SourceDocument[]) => {
    const blob = new Blob([JSON.stringify(documents)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `antelito-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};