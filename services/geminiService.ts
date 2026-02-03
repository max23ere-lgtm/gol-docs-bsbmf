
import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key não encontrada. Verifique as configurações do ambiente.");
  }
  return new GoogleGenAI({ apiKey: apiKey });
};

/**
 * Usa o Gemini 2.5 Flash Image para editar/processar uma imagem.
 */
export const editDocumentImage = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    const ai = getClient();
    const model = 'gemini-2.5-flash-image';

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Image.replace(/^data:image\/\w+;base64,/, ''),
            },
          },
          {
            text: `Edite esta imagem de documento técnico da GOL: ${prompt}. Retorne apenas a imagem processada.`,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Nenhuma imagem gerada pelo modelo.");
  } catch (error) {
    console.error("Erro na Edição de Imagem Gemini:", error);
    throw error;
  }
};

/**
 * Usa o Gemini 3 Flash para extrair o Barcode ou número da WO de uma imagem.
 * Otimizado para documentos de manutenção da GOL (RTA e FAR).
 */
export const extractDataFromImage = async (base64Image: string): Promise<string | null> => {
  try {
    const ai = getClient();
    const model = 'gemini-3-flash-preview';

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', 
              data: base64Image.replace(/^data:image\/\w+;base64,/, ''),
            },
          },
          {
            text: `Aja como um auditor de documentação técnica da GOL Linhas Aéreas.
            Sua tarefa é encontrar o número da Work Order (WO) ou Barcode neste documento de manutenção.
            
            DICAS DE LOCALIZAÇÃO:
            - Geralmente fica no topo do documento ou próximo a um código de barras.
            - O padrão GOL é um número que começa com 100, 101 ou 200.
            
            REGRAS ESTRITAS:
            1. Procure por uma sequência numérica de 7 a 10 dígitos.
            2. Priorize números que iniciem em 100, 101 ou 200.
            3. Ignore números de peças (P/N), números de série (S/N) ou datas.
            4. Responda APENAS os números encontrados, sem espaços ou letras.
            5. Se não tiver certeza absoluta, retorne 'null'.`,
          },
        ],
      },
    });

    const resultText = response.text?.trim() || "";
    
    if (!resultText || resultText.toLowerCase().includes('null')) {
      return null;
    }
    
    // Limpeza: remove tudo que não for número
    const cleanedDigits = resultText.replace(/\D/g, '');
    
    // Validação mínima para evitar falsos positivos
    if (cleanedDigits.length >= 5) {
        // Se for maior que 9, pega os últimos 9 (comum em leituras de código de barras longo)
        return cleanedDigits.length > 9 ? cleanedDigits.slice(-9) : cleanedDigits;
    }
    
    return null;

  } catch (error) {
    console.error("Erro Crítico no Scanner Gemini:", error);
    return null;
  }
};
