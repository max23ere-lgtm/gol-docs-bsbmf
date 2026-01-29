import { DocumentItem } from '../types';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DE AMBIENTE (GOL BSB) ---
// Adicionei suas credenciais diretamente aqui para garantir que conecte imediatamente.
const DEFAULT_URL = "https://tkwysxrflewuvdfwdytj.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrd3lzeHJmbGV3dXZkZndkeXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDc0NzUsImV4cCI6MjA4NTI4MzQ3NX0.BYHu13CO0eO7BxJSSDWISJeSGO1U4rsL69Oj20X0WfM";

const getEnv = (key: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return '';
};

// Lógica de Prioridade:
// 1. Configuração Manual (se alguém mudou na engrenagem)
// 2. Credenciais Padrão (Suas chaves hardcoded - Garantia de funcionamento)
let SUPABASE_URL = DEFAULT_URL;
let SUPABASE_KEY = DEFAULT_KEY;

const manualConfig = localStorage.getItem('gol_supabase_config');
if (manualConfig) {
  try {
    const parsed = JSON.parse(manualConfig);
    if (parsed.url && parsed.key) {
      SUPABASE_URL = parsed.url;
      SUPABASE_KEY = parsed.key;
    }
  } catch (e) { console.error(e); }
} else {
  // Se não tiver manual, verifica variáveis de ambiente, se não tiver, usa o padrão hardcoded
  const envUrl = getEnv('VITE_SUPABASE_URL');
  const envKey = getEnv('VITE_SUPABASE_KEY');
  if (envUrl && envKey) {
    SUPABASE_URL = envUrl;
    SUPABASE_KEY = envKey;
  }
}

// Fallback URL (npoint) - Apenas para leitura de teste se o Supabase falhar
const JSON_API_URL = `https://api.npoint.io/41262d0891510e4c5b6b`;

let supabase: any = null;

const initSupabase = () => {
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log('✅ Supabase conectado (GOL BSB)');
      return true;
    } catch (e) {
      console.error('Erro ao iniciar Supabase', e);
      return false;
    }
  }
  return false;
};

initSupabase();

export const dbService = {
  
  /**
   * Permite salvar as credenciais manualmente via UI
   */
  saveCredentials(url: string, key: string) {
    if (!url || !key) return;
    localStorage.setItem('gol_supabase_config', JSON.stringify({ url, key }));
    window.location.reload(); // Recarrega a página para aplicar
  },

  clearCredentials() {
    localStorage.removeItem('gol_supabase_config');
    window.location.reload();
  },

  isSupabaseConfigured() {
    return !!supabase;
  },

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
      const local = localStorage.getItem('gol_docs_cache');
      if (local) {
        return JSON.parse(local);
      }
      return [];
    } catch (error) {
      return [];
    }
  },

  /**
   * Remove um documento do banco e do cache local
   */
  async deleteDocument(id: string): Promise<boolean> {
    // 1. Remove do cache local imediatamente
    const localStr = localStorage.getItem('gol_docs_cache');
    if (localStr) {
      try {
        const localData = JSON.parse(localStr);
        const newData = localData.filter((d: any) => d.id !== id);
        localStorage.setItem('gol_docs_cache', JSON.stringify(newData));
      } catch (e) { console.error('Erro cache local delete', e); }
    }

    // 2. Remove do Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('documents')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('❌ Erro Supabase DELETE:', error.message);
           if (error.code === '42501') {
             alert('ERRO DE PERMISSÃO AO DELETAR: Rode o comando "disable row level security" no SQL Editor.');
           }
          return false;
        }
        console.log(`🗑️ Documento ${id} removido do Supabase`);
        return true;
      } catch (error) {
        console.error('Erro crítico Supabase Delete:', error);
        return false;
      }
    }
    return true; // Se não tem supabase, considera sucesso pois já tirou do local
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
        console.log('📤 Tentando salvar no Supabase...', docs.length, 'itens');
        
        // Upsert no Supabase
        const { error } = await supabase
          .from('documents')
          .upsert(docs, { onConflict: 'id' });

        if (error) {
          console.error('❌ Erro Supabase UPSERT:', error.message);
          
          // Tratamento específico para o erro de permissão (RLS)
          if (error.code === '42501') {
            alert('⚠️ ERRO DE PERMISSÃO NO BANCO!\n\nVocê precisa rodar o comando SQL para liberar a escrita.\nVá no Supabase > SQL Editor e rode:\n\nalter table public.documents disable row level security;');
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

    return false; 
  }
};