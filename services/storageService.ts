import localforage from 'localforage';
import { SourceDocument, TrainingDatabase, VisitStats, VisitLogEntry } from '../types';

const DB_NAME = 'antelito_library';
const STORE_KEY = 'documents';
const TRAINING_DB_KEY = 'training_databases';
const VISIT_STATS_KEY = 'app_visit_stats';

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
    const text = await response.text();
    if (!text || text.trim() === '' || text.trim() === 'undefined') return [];
    const globalDocs: SourceDocument[] = JSON.parse(text);
    if (!Array.isArray(globalDocs)) return [];
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

export const saveTrainingDatabases = async (databases: TrainingDatabase[]) => {
  try {
    await localforage.setItem(TRAINING_DB_KEY, databases);
  } catch (err) {
    console.error('Error saving training databases:', err);
  }
};

export const loadTrainingDatabases = async (): Promise<TrainingDatabase[]> => {
  try {
    const databases = await localforage.getItem<TrainingDatabase[]>(TRAINING_DB_KEY);
    return databases || [];
  } catch (err) {
    console.error('Error loading training databases:', err);
    return [];
  }
};

export const getVisitStats = async (): Promise<VisitStats> => {
  try {
    const stats = await localforage.getItem<VisitStats>(VISIT_STATS_KEY);
    return stats || { totalVisits: 0, lastVisit: Date.now(), sessionVisits: 0, history: [] };
  } catch (err) {
    console.error('Error loading visit stats:', err);
    return { totalVisits: 0, lastVisit: Date.now(), sessionVisits: 0, history: [] };
  }
};

export const recordAppVisit = async (): Promise<VisitStats> => {
  try {
    const currentStats = await getVisitStats();
    const isNewSession = !sessionStorage.getItem('antelito_visited');
    
    if (isNewSession) {
      sessionStorage.setItem('antelito_visited', 'true');
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    const timeStr = now.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    const newLogEntry: VisitLogEntry = {
      id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      dateStr,
      timeStr,
      isNewSession
    };

    const existingHistory = Array.isArray(currentStats.history) ? currentStats.history : [];
    // Save up to 300 entries, most recent first
    const updatedHistory = [newLogEntry, ...existingHistory].slice(0, 300);

    const updatedStats: VisitStats = {
      totalVisits: (currentStats.totalVisits || 0) + 1,
      lastVisit: Date.now(),
      sessionVisits: (currentStats.sessionVisits || 0) + (isNewSession ? 1 : 0),
      history: updatedHistory
    };

    await localforage.setItem(VISIT_STATS_KEY, updatedStats);
    return updatedStats;
  } catch (err) {
    console.error('Error recording app visit:', err);
    const now = new Date();
    const fallbackEntry: VisitLogEntry = {
      id: `v_${Date.now()}`,
      timestamp: Date.now(),
      dateStr: now.toLocaleDateString('es-ES'),
      timeStr: now.toLocaleTimeString('es-ES'),
      isNewSession: true
    };
    return { totalVisits: 1, lastVisit: Date.now(), sessionVisits: 1, history: [fallbackEntry] };
  }
};

export const resetVisitStats = async (): Promise<VisitStats> => {
  const initial: VisitStats = { totalVisits: 0, lastVisit: Date.now(), sessionVisits: 0, history: [] };
  try {
    await localforage.setItem(VISIT_STATS_KEY, initial);
  } catch (err) {
    console.error('Error resetting visit stats:', err);
  }
  return initial;
};
