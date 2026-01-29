import { DocumentItem } from '../types';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO HÍBRIDA ---
// 1. Tenta usar Supabase (Banco Profissional) se as chaves estiverem no ambiente (Vercel/env)
// 2. Se não, usa npoint.io (JSON Mock para testes)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY;

// Fallback URL (npoint)
const JSON_API_URL = `https://api.npoint.io/41262d0891510e4c5b6b`;

let supabase: any = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('Conectado ao Supabase (Banco de Dados SQL)');
} else {
  console.warn('Variáveis do Supabase não encontradas. Usando modo de compatibilidade (JSON/LocalStorage).');
}

export const dbService = {
  /**
   * Busca os documentos.
   */
  async fetchDocuments(): Promise<DocumentItem[]> {
    // MODO SUPABASE
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .order('createdAt', { ascending: false });

        if (error) throw error;
        
        // Formata o createdAt se necessário, mas geralmente o Supabase retorna ISO
        return data || [];
      } catch (error) {
        console.error('Erro ao buscar do Supabase:', error);
        // Fallback para cache local se o banco falhar
        const local = localStorage.getItem('gol_docs_cache');
        return local ? JSON.parse(local) : [];
      }
    }

    // MODO LEGADO (JSON API)
    try {
      const response = await fetch(JSON_API_URL);
      
      if (!response.ok) {
        console.warn('Servidor JSON retornou erro, tentando recuperar do cache local...');
        const local = localStorage.getItem('gol_docs_cache');
        return local ? JSON.parse(local) : [];
      }

      const data = await response.json();
      
      if (data && Array.isArray(data)) {
        localStorage.setItem('gol_docs_cache', JSON.stringify(data));
        return data;
      }
      return [];
    } catch (error) {
      console.error('Falha crítica no download dos dados (JSON):', error);
      const local = localStorage.getItem('gol_docs_cache');
      return local ? JSON.parse(local) : [];
    }
  },

  /**
   * Salva os documentos.
   */
  async saveDocuments(docs: DocumentItem[]): Promise<boolean> {
    // Cache Local de Segurança
    localStorage.setItem('gol_docs_cache', JSON.stringify(docs));

    // MODO SUPABASE
    if (supabase) {
      try {
        // O Supabase permite 'upsert' (inserir ou atualizar)
        // Nota: Enviar o array inteiro pode ser pesado em produção. 
        // Idealmente, você salvaria apenas o documento alterado, mas para manter compatibilidade com o app atual:
        const { error } = await supabase
          .from('documents')
          .upsert(docs, { onConflict: 'id' });

        if (error) {
          console.error('Erro ao salvar no Supabase:', error);
          return false;
        }
        return true;
      } catch (error) {
        console.error('Erro crítico Supabase:', error);
        return false;
      }
    }

    // MODO LEGADO (JSON API)
    try {
      const response = await fetch(JSON_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(docs),
      });
      
      return response.ok;
    } catch (error) {
      console.error('Falha crítica no upload dos dados (JSON):', error);
      return false;
    }
  }
};