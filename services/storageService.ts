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
    await localforage.setItem(STORE_KEY, documents);
  } catch (err) {
    console.error('Error saving library:', err);
  }
};

export const loadLibrary = async (): Promise<SourceDocument[]> => {
  try {
    const docs = await localforage.getItem<SourceDocument[]>(STORE_KEY);
    return docs || [];
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