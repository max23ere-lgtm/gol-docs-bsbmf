import { DocumentItem } from '../types';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DE AMBIENTE (GOL BSB) ---
const DEFAULT_URL = "https://tkwysxrflewuvdfwdytj.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrd3lzeHJmbGV3dXZkZndkeXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDc0NzUsImV4cCI6MjA4NTI4MzQ3NX0.BYHu13CO0eO7BxJSSDWISJeSGO1U4rsL69Oj20X0WfM";

// Inicialização direta e garantida
let supabase: any = null;

const initSupabase = () => {
  try {
    supabase = createClient(DEFAULT_URL, DEFAULT_KEY);
    console.log('✅ Supabase conectado (GOL BSB)');
    return true;
  } catch (e) {
    console.error('Erro ao iniciar Supabase', e);
    return false;
  }
};

initSupabase();

export const dbService = {
  
  isSupabaseConfigured() {
    return !!supabase;
  },

  /**
   * Busca os documentos.
   */
  async fetchDocuments(): Promise<DocumentItem[]> {
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
        
        return data || [];
      } catch (error) {
        console.warn('Falha na conexão Supabase, tentando cache local...');
        const local = localStorage.getItem('gol_docs_cache');
        return local ? JSON.parse(local) : [];
      }
    }
    return [];
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
        return true;
      } catch (error) {
        console.error('Erro crítico Supabase Delete:', error);
        return false;
      }
    }
    return true; 
  },

  /**
   * Salva os documentos.
   */
  async saveDocuments(docs: DocumentItem[]): Promise<boolean> {
    // Cache Local de Segurança
    localStorage.setItem('gol_docs_cache', JSON.stringify(docs));

    if (supabase) {
      try {
        // Upsert no Supabase
        const { error } = await supabase
          .from('documents')
          .upsert(docs, { onConflict: 'id' });

        if (error) {
          console.error('❌ Erro Supabase UPSERT:', error.message);
          return false;
        }
        return true;
      } catch (error) {
        console.error('Erro crítico Supabase:', error);
        return false;
      }
    }

    return false; 
  }
};