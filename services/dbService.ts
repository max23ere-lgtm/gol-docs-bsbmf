
import { DocumentItem } from '../types';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';

// Configuração do Projeto "GolDocsBSB"
const firebaseConfig = {
  apiKey: "AIzaSyC_JODOZx5fQW7pTQIpb90Zi5LfAvMXLtY",
  authDomain: "goldocsbsb.firebaseapp.com",
  projectId: "goldocsbsb",
  storageBucket: "goldocsbsb.firebasestorage.app",
  messagingSenderId: "776775880711",
  appId: "1:776775880711:web:71bbbdbea9758945855aa2"
};

// Inicialização segura do banco de dados (Evita duplicidade em reloads)
let db: any = null;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  console.log("🔥 Firebase 'GolDocsBSB' conectado com sucesso!");
} catch (e) {
  console.error("Erro fatal ao iniciar Firebase:", e);
}

const COLLECTION_NAME = "documents";

export const dbService = {
  
  /**
   * Busca documentos do Firebase e mescla com o cache local.
   */
  async fetchDocuments(): Promise<DocumentItem[]> {
    // 1. Carrega o cache local primeiro (Offline First)
    const local = localStorage.getItem('gol_docs_cache');
    let localData: DocumentItem[] = [];
    try {
      localData = local ? JSON.parse(local) : [];
    } catch (e) {
      localData = [];
    }

    // Se o banco não estiver configurado, retorna apenas local
    if (!db) return localData;

    try {
      // 2. Busca dados da nuvem
      const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
      const remoteData: DocumentItem[] = [];
      
      querySnapshot.forEach((doc) => {
        remoteData.push(doc.data() as DocumentItem);
      });

      if (remoteData.length > 0) {
        // 3. Mesclagem Inteligente (Merge)
        const merged = [...localData];
        
        remoteData.forEach((remoteDoc) => {
          const index = merged.findIndex(d => d.id === remoteDoc.id);
          
          if (index === -1) {
            merged.push(remoteDoc);
          } else {
            // Atualiza local com dados da nuvem (fonte da verdade)
            merged[index] = { ...merged[index], ...remoteDoc };
          }
        });

        // Ordena por data de criação
        const finalData = merged.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        localStorage.setItem('gol_docs_cache', JSON.stringify(finalData));
        return finalData;
      }
      
      return localData;
    } catch (error: any) {
      console.warn('⚠️ Erro de conexão com Firebase (Usando dados locais):', error.message);
      return localData;
    }
  },

  /**
   * Deleta um único documento
   */
  async deleteDocument(id: string): Promise<boolean> {
    return this.deleteDocuments([id]);
  },

  /**
   * Deleta múltiplos documentos (Bulk Delete)
   */
  async deleteDocuments(ids: string[]): Promise<boolean> {
    // 1. Remove do LocalStorage imediatamente
    const local = localStorage.getItem('gol_docs_cache');
    if (local) {
      try {
        const localData = JSON.parse(local);
        const newData = localData.filter((d: any) => !ids.includes(d.id));
        localStorage.setItem('gol_docs_cache', JSON.stringify(newData));
      } catch (e) {}
    }

    if (!db) return true;

    try {
      // 2. Remove do Firebase usando Batch Write
      const batch = writeBatch(db);
      
      ids.forEach(id => {
        const docRef = doc(db, COLLECTION_NAME, id);
        batch.delete(docRef);
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error("Erro ao deletar no Firebase:", error);
      return false;
    }
  },

  /**
   * Salva/Sincroniza documentos
   */
  async saveDocuments(docs: DocumentItem[]): Promise<boolean> {
    if (!docs || docs.length === 0) return true;

    // 1. Salvamento Local Obrigatório
    localStorage.setItem('gol_docs_cache', JSON.stringify(docs));

    if (!db) return false;

    try {
      const batch = writeBatch(db);
      let count = 0;
      
      // Limita a 400 operações para segurança (limite do Firestore é 500)
      const docsToSync = docs.slice(0, 400); 

      for (const d of docsToSync) {
        const docRef = doc(db, COLLECTION_NAME, d.id);
        batch.set(docRef, d, { merge: true });
        count++;
      }
      
      if (count > 0) {
        await batch.commit();
      }

      return true;
    } catch (error: any) {
      console.error('Erro de Sincronização Firebase:', error.message);
      return false;
    }
  }
};
