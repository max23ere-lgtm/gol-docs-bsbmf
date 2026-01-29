import { DocumentItem } from '../types';

// Usando um endpoint de base de dados JSON persistente para a GOL BSB
// Nota: Em produção, este ID deve ser mantido em segredo ou substituído por uma API própria da GOL.
const API_URL = `https://api.npoint.io/41262d0891510e4c5b6b`; 

export const dbService = {
  /**
   * Busca os documentos da base centralizada.
   * Se a base não existir ou estiver vazia, retorna um array vazio.
   */
  async fetchDocuments(): Promise<DocumentItem[]> {
    try {
      const response = await fetch(API_URL);
      
      if (!response.ok) {
        // Se der erro 404 ou 500, assumimos que a base pode estar em manutenção ou vazia
        console.warn('Servidor retornou erro, tentando recuperar do cache local...');
        const local = localStorage.getItem('gol_docs_cache');
        return local ? JSON.parse(local) : [];
      }

      const data = await response.json();
      
      // Validação: Garante que os dados recebidos são de fato um array de documentos
      if (data && Array.isArray(data)) {
        localStorage.setItem('gol_docs_cache', JSON.stringify(data));
        return data;
      }
      
      // Se o formato for inválido (objeto vazio p.ex), retorna array vazio
      return [];
    } catch (error) {
      console.error('Falha crítica no download dos dados:', error);
      const local = localStorage.getItem('gol_docs_cache');
      return local ? JSON.parse(local) : [];
    }
  },

  /**
   * Salva o estado atual dos documentos na nuvem para todos os usuários.
   */
  async saveDocuments(docs: DocumentItem[]): Promise<boolean> {
    try {
      // 1. Salva no cache local imediatamente (segurança)
      localStorage.setItem('gol_docs_cache', JSON.stringify(docs));

      // 2. Tenta enviar para o servidor central
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(docs),
      });
      
      return response.ok;
    } catch (error) {
      console.error('Falha crítica no upload dos dados:', error);
      return false;
    }
  }
};