import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
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

export const generateTrainingComparison = async (
  dbAName: string,
  dbAContent: string,
  dbBName: string,
  dbBContent: string
) => {
  const prompt = `
  Eres un Agente de IA experto en Capacitación de Personal y Análisis de Datos Corporativos.
  Tu tarea es comparar dos bases de datos o conjuntos de documentos de capacitación ("${dbAName}" y "${dbBName}") y producir un informe estructurado que resuelva dudas de personal, detecte inconsistencias o novedades, y diseñe un plan de aprendizaje.

  CONJUNTO A (${dbAName}):
  ${dbAContent || 'No hay contenido o está vacío.'}

  CONJUNTO B (${dbBName}):
  ${dbBContent || 'No hay contenido o está vacío.'}

  Por favor, analiza la información y genera:
  1. Un resumen comparativo general de ambos conjuntos de datos en español.
  2. Una lista de diferencias clave, cambios de política, contradicciones, actualizaciones de tarifas o de procedimientos.
  3. Un plan de capacitación sugerido para el personal basado en estas diferencias o contenidos.
  4. Un cuestionario (Quiz) interactivo de 4 preguntas de opción múltiple para evaluar la comprensión del personal sobre estos temas.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: "Resumen comparativo detallado en español."
          },
          differences: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                point: { type: Type.STRING, description: "Aspecto o tema de la diferencia (ej: Costo de conexión, horario, etc.)" },
                dbAVal: { type: Type.STRING, description: "Valor o estado en la Base de Datos A o documento anterior." },
                dbBVal: { type: Type.STRING, description: "Valor o estado en la Base de Datos B o documento nuevo." },
                explanation: { type: Type.STRING, description: "Explicación breve de por qué cambió o la relevancia para la capacitación." }
              },
              required: ["point", "dbAVal", "dbBVal", "explanation"]
            },
            description: "Lista de diferencias, contradicciones o cambios clave detectados."
          },
          learningPath: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                step: { type: Type.STRING, description: "Número de paso, ej: 'Paso 1'" },
                title: { type: Type.STRING, description: "Título del módulo o actividad de capacitación" },
                content: { type: Type.STRING, description: "Detalle de lo que el personal debe aprender en esta etapa." }
              },
              required: ["step", "title", "content"]
            },
            description: "Plan de capacitación interactivo paso a paso."
          },
          quiz: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: "Pregunta del cuestionario." },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "4 opciones de respuesta."
                },
                correctIndex: { type: Type.INTEGER, description: "Índice de la respuesta correcta (0, 1, 2 o 3)." },
                explanation: { type: Type.STRING, description: "Explicación detallada de por qué esta respuesta es la correcta." }
              },
              required: ["question", "options", "correctIndex", "explanation"]
            },
            description: "Cuestionario de evaluación interactivo de 4 preguntas."
          }
        },
        required: ["summary", "differences", "learningPath", "quiz"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Failed to parse training comparison response:", e);
    return {
      summary: response.text || "Error al generar el informe en formato estructurado.",
      differences: [],
      learningPath: [],
      quiz: []
    };
  }
};

export const createTrainingChatSession = (dbName: string, dbContent: string) => {
  const instruction = `
  Eres el "Agente IA de Capacitación de Personal" de Antelito 3.0.
  Tu objetivo es capacitar al personal, responder preguntas sobre la base de datos de capacitación seleccionada ("${dbName}"), realizar explicaciones sencillas y amigables, y evaluar sus conocimientos de manera constructiva.

  INFORMACIÓN DE LA BASE DE DATOS DE CAPACITACIÓN ("${dbName}"):
  ${dbContent || 'No hay contenido disponible en esta base de datos actualmente.'}

  REGLAS DE CONDUCTA:
  1. Responde de forma didáctica, alentadora y clara en español. Eres un tutor corporativo paciente.
  2. Si el usuario te pide que le hagas una pregunta o lo evalúes, formula una pregunta basada en los documentos y espera su respuesta.
  3. Utiliza formato Markdown (negritas, listas, tablas si es necesario) para estructurar tus respuestas didácticamente.
  4. Si te preguntan algo fuera de la base de datos de capacitación, guíalos de vuelta amablemente diciendo que estás enfocado en la capacitación de "${dbName}".
  `;

  return ai.chats.create({
    model: 'gemini-3.5-flash',
    config: {
      systemInstruction: instruction,
    },
  });
};