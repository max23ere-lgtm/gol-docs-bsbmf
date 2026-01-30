
import { DocumentItem } from '../types';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = "https://tkwysxrflewuvdfwdytj.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrd3lzeHJmbGV3dXZkZndkeXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDc0NzUsImV4cCI6MjA4NTI4MzQ3NX0.BYHu13CO0eO7BxJSSDWISJeSGO1U4rsL69Oj20X0WfM";

let supabase: any = null;

const initSupabase = () => {
  try {
    supabase = createClient(DEFAULT_URL, DEFAULT_KEY);
    return true;
  } catch (e) {
    console.error('Erro ao iniciar Supabase:', e);
    return false;
  }
};

initSupabase();

export const dbService = {
  
  isSupabaseConfigured() {
    return !!supabase;
  },

  async fetchDocuments(): Promise<DocumentItem[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
        console.error('❌ Erro Supabase SELECT:', error);
        throw error;
      }
      
      // Atualiza cache local após sucesso
      if (data) localStorage.setItem('gol_docs_cache', JSON.stringify(data));
      return data || [];
    } catch (error: any) {
      console.warn('⚠️ Falha Supabase, carregando local:', error.message);
      const local = localStorage.getItem('gol_docs_cache');
      return local ? JSON.parse(local) : [];
    }
  },

  async deleteDocument(id: string): Promise<boolean> {
    const localStr = localStorage.getItem('gol_docs_cache');
    if (localStr) {
      try {
        const localData = JSON.parse(localStr);
        const newData = localData.filter((d: any) => d.id !== id);
        localStorage.setItem('gol_docs_cache', JSON.stringify(newData));
      } catch (e) {}
    }

    if (!supabase) return true;
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Erro Supabase DELETE:', error);
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  },

  async saveDocuments(docs: DocumentItem[]): Promise<boolean> {
    if (docs.length === 0) return true; // Evita salvar lista vazia desnecessariamente

    // Cache local imediato (Segurança)
    localStorage.setItem('gol_docs_cache', JSON.stringify(docs));

    if (!supabase) return false;
    try {
      // Upsert sincronizado
      const { error } = await supabase
        .from('documents')
        .upsert(docs, { onConflict: 'id' });

      if (error) {
        console.error('❌ Erro ao salvar na nuvem:', error.message);
        if (error.code === '42P01') {
          console.error('DICA: A tabela "documents" não foi criada no Supabase.');
        }
        return false;
      }
      return true;
    } catch (error) {
      console.error('Erro crítico de rede:', error);
      return false;
    }
  }
};
