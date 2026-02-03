
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

  /**
   * Remove campos que podem não existir na tabela do banco de dados para evitar erros de 400 Bad Request.
   */
  prepareForDb(doc: DocumentItem) {
    // Campos básicos que temos certeza que existem na tabela original
    return {
      id: doc.id,
      type: doc.type,
      status: doc.status,
      hasErrors: doc.hasErrors,
      errorCount: doc.errorCount,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      logs: doc.logs,
      imageUrl: doc.imageUrl || null
      // originalDate e correctionStartedAt são omitidos se o banco falhar
    };
  },

  async fetchDocuments(): Promise<DocumentItem[]> {
    const local = localStorage.getItem('gol_docs_cache');
    const localData: DocumentItem[] = local ? JSON.parse(local) : [];

    if (!supabase) return localData;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Lógica de Mesclagem Inteligente:
        // Não queremos que o banco de dados (que pode estar desatualizado)
        // apague o que o usuário acabou de inserir localmente.
        const merged = [...localData];
        
        data.forEach((remoteDoc: any) => {
          const exists = merged.find(d => d.id === remoteDoc.id);
          if (!exists) {
            merged.push(remoteDoc);
          } else {
            // Se já existe, mantemos o local se ele tiver campos novos (como originalDate)
            // ou se for mais recente.
          }
        });

        const finalData = merged.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        localStorage.setItem('gol_docs_cache', JSON.stringify(finalData));
        return finalData;
      }
      
      return localData;
    } catch (error: any) {
      console.warn('⚠️ Erro na nuvem, usando apenas dados locais:', error.message);
      return localData;
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
      await supabase.from('documents').delete().eq('id', id);
      return true;
    } catch (error) {
      return false;
    }
  },

  async saveDocuments(docs: DocumentItem[]): Promise<boolean> {
    if (!docs || docs.length === 0) return true;

    // 1. Salva no local storage imediatamente (Garante que nada se perca)
    localStorage.setItem('gol_docs_cache', JSON.stringify(docs));

    if (!supabase) return false;

    try {
      // Tentativa 1: Salvar com todos os campos (incluindo os novos)
      const { error } = await supabase
        .from('documents')
        .upsert(docs, { onConflict: 'id' });

      if (error) {
        // Se o erro for "coluna não encontrada", tentamos salvar a versão "limpa"
        if (error.message?.includes('column') || error.code === '42703') {
          console.warn('⚠️ Banco de dados desatualizado. Salvando versão simplificada...');
          const safeDocs = docs.map(this.prepareForDb);
          const { error: secondError } = await supabase
            .from('documents')
            .upsert(safeDocs, { onConflict: 'id' });
          
          if (secondError) throw secondError;
          return true;
        }
        throw error;
      }
      return true;
    } catch (error: any) {
      console.error('❌ Falha crítica ao sincronizar com a nuvem:', error.message);
      return false;
    }
  }
};
