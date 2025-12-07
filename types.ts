export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export type UserRole = 'admin' | 'user';

export interface Attachment {
  type: 'image';
  mimeType: string;
  data: string; // Base64
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  attachments?: Attachment[];
  isThinking?: boolean;
}

export interface SourceDocument {
  id: string;
  name: string;
  type: string;
  content: string; // Text content of the file
  isSelected: boolean;
  readOnly?: boolean; // Indicates if the file is a global/fixed file
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}