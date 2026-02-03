
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
            text: `Edite esta imagem de documento técnico: ${prompt}. Retorne apenas a imagem processada.`,
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
 * Otimizado para documentos de manutenção da GOL.
 */
export const extractDataFromImage = async (base64Image: string): Promise<string | null> => {
  try {
    const ai = getClient();
    // gemini-3-flash-preview é ideal para OCR rápido e preciso
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
            text: `Aja como um especialista em documentação de manutenção aeronáutica (GOL Linhas Aéreas).
            Analise esta imagem e extraia o número de identificação principal do documento (Work Order / Barcode).
            
            Regras de Extração:
            1. Procure por um número de exatamente 9 dígitos.
            2. O número DEVE começar com os prefixos: 100, 101 ou 200.
            3. Ignore números de série de peças, datas, prefixos de aeronaves ou outros códigos menores.
            4. Responda APENAS os dígitos encontrados. Não inclua texto, pontuação ou explicações.
            5. Se não encontrar nenhum número que siga o padrão de 9 dígitos iniciando em 100/101/200, retorne exatamente a palavra: null`,
          },
        ],
      },
    });

    // Acessa a propriedade .text (getter) conforme as diretrizes
    const resultText = response.text?.trim() || "";
    
    if (!resultText || resultText.toLowerCase().includes('null')) {
      console.debug("Gemini: Nenhum código válido identificado na imagem.");
      return null;
    }
    
    // Limpeza rigorosa: remove qualquer coisa que não seja número (evita markdown, espaços, etc)
    const cleanedDigits = resultText.replace(/\D/g, '');
    
    // Validação final de formato GOL (mínimo 5 dígitos para ser um WO aceitável em casos parciais)
    if (cleanedDigits.length >= 5) {
        console.debug("Gemini: Código extraído com sucesso:", cleanedDigits);
        return cleanedDigits;
    }
    
    return null;

  } catch (error) {
    console.error("Erro Crítico no Scanner Gemini:", error);
    return null;
  }
};
