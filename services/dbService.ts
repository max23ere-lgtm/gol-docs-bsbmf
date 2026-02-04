
import { DocumentItem } from '../types';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = "https://tkwysxrflewuvdfwdytj.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrd3lzeHJmbGV3dXZkZndkeXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDc0NzUsImV4cCI6MjA4NTI4MzQ3NX0.BYHu13CO0eO7BxJSSDWISJeSGO1U4rsL69Oj20X0WfM";

let supabase: any = null;

try {
  supabase = createClient(DEFAULT_URL, DEFAULT_KEY);
} catch (e) {
  console.error('Erro ao iniciar Supabase:', e);
}

export const dbService = {
  
  /**
   * Remove campos novos caso o banco de dados ainda seja antigo.
   */
  sanitizeForLegacyDb(doc: DocumentItem) {
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
    };
  },

  async fetchDocuments(): Promise<DocumentItem[]> {
    const local = localStorage.getItem('gol_docs_cache');
    let localData: DocumentItem[] = [];
    try {
      localData = local ? JSON.parse(local) : [];
    } catch (e) {
      localData = [];
    }

    if (!supabase) return localData;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const merged = [...localData];
        
        data.forEach((remoteDoc: any) => {
          const existsIndex = merged.findIndex(d => d.id === remoteDoc.id);
          if (existsIndex === -1) {
            merged.push(remoteDoc);
          } else {
            // Se o documento remoto tiver data original e o local não, atualizamos o local
            if (remoteDoc.originalDate && !merged[existsIndex].originalDate) {
               merged[existsIndex].originalDate = remoteDoc.originalDate;
            }
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
      console.warn('⚠️ Operando em modo Local/Offline:', error.message);
      return localData;
    }
  },

  async deleteDocument(id: string): Promise<boolean> {
    const local = localStorage.getItem('gol_docs_cache');
    if (local) {
      try {
        const localData = JSON.parse(local);
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

    // 1. Salvamento Local Obrigatório
    localStorage.setItem('gol_docs_cache', JSON.stringify(docs));

    if (!supabase) return false;

    try {
      // TENTATIVA 1: Enviar TUDO (Migração Completa)
      // Isso tenta salvar originalDate e correctionStartedAt
      const { error } = await supabase
        .from('documents')
        .upsert(docs, { onConflict: 'id' });

      if (error) {
        // Se der erro de coluna não encontrada (código 42703 no Postgres ou mensagem genérica)
        if (error.code === '42703' || error.message?.includes('column')) {
           console.warn("⚠️ Schema do banco desatualizado. Tentando salvamento legado...");
           
           // TENTATIVA 2: Enviar versão limpa (Fallback)
           const legacyPayload = docs.map(d => this.sanitizeForLegacyDb(d));
           const { error: legacyError } = await supabase
            .from('documents')
            .upsert(legacyPayload, { onConflict: 'id' });
            
           if (legacyError) throw legacyError;
           return true;
        }
        throw error;
      }
      return true;
    } catch (error: any) {
      console.error('Erro de Sincronização:', error.message);
      return false;
    }
  }
};
