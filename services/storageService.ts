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
    if (!text || text.trim() === '' || text.trim() === 'undefined' || text.trim().startsWith('<')) return [];
    try {
      const globalDocs: SourceDocument[] = JSON.parse(text);
      if (!Array.isArray(globalDocs)) return [];
      // Asegurarnos de que tengan el flag readOnly y estén seleccionados por defecto
      return globalDocs.map(doc => ({ ...doc, readOnly: true, isSelected: true }));
    } catch (parseError) {
      console.warn("Could not parse library.json:", parseError);
      return [];
    }
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
    const res = await fetch('/api/visits');
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim() !== '' && text.trim() !== 'undefined' && !text.trim().startsWith('<')) {
        try {
          const data = JSON.parse(text);
          if (data && typeof data.totalVisits === 'number') {
            await localforage.setItem(VISIT_STATS_KEY, data);
            return data;
          }
        } catch (e) {
          console.warn('Failed to parse /api/visits JSON:', e);
        }
      }
    }
  } catch (err) {
    console.warn('API /api/visits unreachable, falling back to local storage', err);
  }

  try {
    const stats = await localforage.getItem<VisitStats>(VISIT_STATS_KEY);
    return stats || { totalVisits: 0, lastVisit: Date.now(), sessionVisits: 0, history: [] };
  } catch (err) {
    console.error('Error loading visit stats:', err);
    return { totalVisits: 0, lastVisit: Date.now(), sessionVisits: 0, history: [] };
  }
};

export const recordAppVisit = async (): Promise<VisitStats> => {
  const isNewSession = !sessionStorage.getItem('antelito_visited');
  if (isNewSession) {
    sessionStorage.setItem('antelito_visited', 'true');
  }

  try {
    const res = await fetch('/api/visits/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isNewSession })
    });
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim() !== '' && text.trim() !== 'undefined' && !text.trim().startsWith('<')) {
        try {
          const data = JSON.parse(text);
          if (data && typeof data.totalVisits === 'number') {
            await localforage.setItem(VISIT_STATS_KEY, data);
            return data;
          }
        } catch (e) {
          console.warn('Failed to parse /api/visits/record JSON:', e);
        }
      }
    }
  } catch (err) {
    console.warn('API /api/visits/record unreachable, falling back to local storage', err);
  }

  try {
    const currentStats = await localforage.getItem<VisitStats>(VISIT_STATS_KEY) || { totalVisits: 0, lastVisit: Date.now(), sessionVisits: 0, history: [] };
    const now = new Date();
    const newLogEntry: VisitLogEntry = {
      id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      dateStr: now.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
      timeStr: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isNewSession
    };
    const updatedHistory = [newLogEntry, ...(currentStats.history || [])].slice(0, 300);
    const updatedStats: VisitStats = {
      totalVisits: (currentStats.totalVisits || 0) + 1,
      lastVisit: Date.now(),
      sessionVisits: (currentStats.sessionVisits || 0) + (isNewSession ? 1 : 0),
      history: updatedHistory
    };
    await localforage.setItem(VISIT_STATS_KEY, updatedStats);
    return updatedStats;
  } catch (err) {
    console.error('Error recording app visit locally:', err);
    return { totalVisits: 1, lastVisit: Date.now(), sessionVisits: 1, history: [] };
  }
};

export const resetVisitStats = async (): Promise<VisitStats> => {
  try {
    const res = await fetch('/api/visits/reset', { method: 'POST' });
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim() !== '' && text.trim() !== 'undefined' && !text.trim().startsWith('<')) {
        try {
          const data = JSON.parse(text);
          await localforage.setItem(VISIT_STATS_KEY, data);
          return data;
        } catch (e) {
          console.warn('Failed to parse /api/visits/reset JSON:', e);
        }
      }
    }
  } catch (err) {
    console.warn('API /api/visits/reset unreachable', err);
  }

  const initial: VisitStats = { totalVisits: 0, lastVisit: Date.now(), sessionVisits: 0, history: [] };
  try {
    await localforage.setItem(VISIT_STATS_KEY, initial);
  } catch (err) {
    console.error('Error resetting visit stats locally:', err);
  }
  return initial;
};
