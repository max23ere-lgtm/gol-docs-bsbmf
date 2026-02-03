
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
   * Limpa o objeto para o formato que a tabela 'documents' aceita.
   * Isso evita o erro 400 (Bad Request) por colunas inexistentes.
   */
  mapToDbSchema(doc: DocumentItem) {
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
      // Note: originalDate e correctionStartedAt são mantidos apenas localmente 
      // até que a tabela do banco seja atualizada.
    };
  },

  async fetchDocuments(): Promise<DocumentItem[]> {
    // 1. Sempre pega o cache local primeiro
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
        // MESCLAGEM INTELIGENTE:
        // Mantemos tudo que está no localData (trabalho recente)
        // e adicionamos o que está no banco mas não está no local.
        const merged = [...localData];
        
        data.forEach((remoteDoc: any) => {
          const exists = merged.find(d => d.id === remoteDoc.id);
          if (!exists) {
            merged.push(remoteDoc);
          } else {
            // Se já existe no local, não mexemos, pois o local é a 
            // "verdade" de quem está operando agora.
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
      console.warn('⚠️ Usando modo offline. Motivo:', error.message);
      return localData;
    }
  },

  async saveDocuments(docs: DocumentItem[]): Promise<boolean> {
    if (!docs || docs.length === 0) return true;

    // SALVAMENTO LOCAL IMEDIATO (Crítico para não sumir ao atualizar)
    localStorage.setItem('gol_docs_cache', JSON.stringify(docs));

    if (!supabase) return false;

    try {
      // Preparamos os dados para o formato que o banco aceita
      const dbDocs = docs.map(this.mapToDbSchema);

      const { error } = await supabase
        .from('documents')
        .upsert(dbDocs, { onConflict: 'id' });

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao sincronizar com a nuvem:', error.message);
      // Retornamos falso para o App mostrar o ícone de "Offline/Erro"
      return false;
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
  }
};
