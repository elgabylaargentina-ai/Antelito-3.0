import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message, Role, Attachment } from '../types';

// Validation: Ensure API Key is present
const apiKey = process.env.API_KEY;
if (!apiKey || apiKey.includes("API_KEY")) {
  console.warn("API_KEY no encontrada. Asegúrate de configurar VITE_API_KEY en Vercel.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-build' });

export const createChatSession = (contextText: string = '') => {
  let instruction = "Eres Antelito, un asistente de investigación inteligente y útil. ";
  
  if (contextText.trim()) {
    instruction += `
    \n\nTU OBJETIVO PRINCIPAL:
    Responder a las preguntas del usuario basándote EXCLUSIVAMENTE en la información proporcionada en la "Biblioteca de Documentos" a continuación.
    
    REGLAS:
    1. Si la respuesta se encuentra en los documentos, cítala o parafraséala con precisión.
    2. Si la respuesta NO está en los documentos, di claramente: "No encontré información sobre eso en tus documentos cargados."
    3. No inventes información.
    4. Utiliza formato Markdown para estructurar tus respuestas.
    
    --- INICIO DE BIBLIOTECA DE DOCUMENTOS ---
    ${contextText}
    --- FIN DE BIBLIOTECA DE DOCUMENTOS ---
    `;
  } else {
    instruction += "Actualmente no hay documentos en la biblioteca. Pide amablemente al usuario que suba documentos (.txt, .md, .csv) para comenzar a analizarlos.";
  }

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: instruction,
    },
  });
};

export const sendMessageStream = async (
  chat: Chat, 
  text: string, 
  attachments: Attachment[] = []
): Promise<AsyncIterable<GenerateContentResponse>> => {
  
  if (attachments.length > 0) {
    const parts: any[] = [];
    
    // Add images
    attachments.forEach(att => {
        parts.push({
            inlineData: {
                mimeType: att.mimeType,
                data: att.data
            }
        });
    });

    // Add text
    if (text) {
        parts.push({ text });
    }

    return chat.sendMessageStream({ message: parts });
  } else {
    // Simple text message
    return chat.sendMessageStream({ message: text });
  }
};