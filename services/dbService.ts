import { DocumentItem } from '../types';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DE AMBIENTE ---
// Função segura para pegar variáveis de ambiente (Funciona em Vite e Webpack)
const getEnv = (key: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_KEY = getEnv('VITE_SUPABASE_KEY');

// Fallback URL (npoint) - Apenas para leitura de teste se o Supabase falhar
const JSON_API_URL = `https://api.npoint.io/41262d0891510e4c5b6b`;

let supabase: any = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('✅ Supabase conectado:', SUPABASE_URL);
} else {
  console.warn('⚠️ Supabase NÃO configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_KEY.');
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

        if (error) {
          console.error('❌ Erro Supabase SELECT:', error.message);
          throw error;
        }
        
        console.log('📥 Dados baixados do Supabase:', data?.length);
        return data || [];
      } catch (error) {
        console.warn('Falha na conexão Supabase, tentando cache local...');
        const local = localStorage.getItem('gol_docs_cache');
        return local ? JSON.parse(local) : [];
      }
    }

    // MODO LEGADO (JSON API)
    try {
      console.log('Usando modo legado (Npoint/Local)...');
      const response = await fetch(JSON_API_URL);
      if (!response.ok) throw new Error('Npoint off');

      const data = await response.json();
      if (data && Array.isArray(data)) {
        localStorage.setItem('gol_docs_cache', JSON.stringify(data));
        return data;
      }
      return [];
    } catch (error) {
      const local = localStorage.getItem('gol_docs_cache');
      return local ? JSON.parse(local) : [];
    }
  },

  /**
   * Salva os documentos.
   */
  async saveDocuments(docs: DocumentItem[]): Promise<boolean> {
    // Cache Local de Segurança (Sempre salva localmente primeiro)
    localStorage.setItem('gol_docs_cache', JSON.stringify(docs));

    // MODO SUPABASE
    if (supabase) {
      try {
        console.log('📤 Tentando salvar no Supabase...', docs.length, 'itens');
        
        // Upsert no Supabase
        const { error } = await supabase
          .from('documents')
          .upsert(docs, { onConflict: 'id' });

        if (error) {
          console.error('❌ Erro Supabase UPSERT:', error.message, error.details);
          // Se o erro for de permissão (RLS), avisa no console
          if (error.code === '42501') {
            alert('ERRO DE PERMISSÃO: O banco de dados bloqueou a gravação. Execute o comando SQL de "disable row level security" no Supabase.');
          }
          return false;
        }
        
        console.log('✅ Salvo no Supabase com sucesso!');
        return true;
      } catch (error) {
        console.error('Erro crítico Supabase:', error);
        return false;
      }
    }

    console.warn('⚠️ Tentativa de salvar sem Supabase configurado (apenas LocalStorage atualizado).');
    return false; // Retorna false para mostrar o ícone de erro na UI
  }
};
