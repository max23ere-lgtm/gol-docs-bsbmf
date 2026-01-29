import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Barcode, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  FileText, 
  Trash2, 
  ArrowRight,
  Plane,
  History,
  Camera,
  User,
  LogOut,
  Calendar as CalendarIcon,
  Filter,
  ShieldCheck,
  CloudCheck,
  CloudDownload,
  CloudOff,
  RefreshCw,
  Loader2,
  Database,
  Lock
} from 'lucide-react';
import { DocumentItem, DocStatus, DocLog, STATUS_LABELS, STATUS_COLORS } from './types';
import { StatusBadge } from './components/StatusBadge';
import { Infographic } from './components/Infographic';
import { LogViewer } from './components/LogViewer';
import { dbService } from './services/dbService';

// Senha única compartilhada pela equipe
const SHARED_ACCESS_KEY = 'JGOL@BSBMFCDT$';

function App() {
  // Login State
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem('gol_current_user');
  });
  const [loginNameInput, setLoginNameInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');

  // Main App State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  
  const [scanInput, setScanInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingLogsDocId, setViewingLogsDocId] = useState<string | null>(null);
  
  // Filters
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocStatus | null>(null);

  // 1. CARREGAMENTO INICIAL E FUNÇÃO DE REFRESH
  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await dbService.fetchDocuments();
      setDocuments(data);
      setSyncError(false);
    } catch (err) {
      setSyncError(true);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 2. SINCRONIZAÇÃO AUTOMÁTICA (SALVAMENTO)
  // Usamos um ref para evitar que o salvamento automático ocorra logo no primeiro carregamento
  const dataLoaded = useRef(false);
  useEffect(() => {
    if (isLoading) return;
    if (!dataLoaded.current && documents.length > 0) {
      dataLoaded.current = true;
      return;
    }

    const timer = setTimeout(async () => {
      if (documents.length === 0 && !dataLoaded.current) return;
      
      setIsSyncing(true);
      const success = await dbService.saveDocuments(documents);
      setIsSyncing(false);
      setSyncError(!success);
    }, 1200);

    return () => clearTimeout(timer);
  }, [documents, isLoading]);

  // Login Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação de Senha
    if (loginPasswordInput !== SHARED_ACCESS_KEY) {
      alert("Senha de acesso incorreta. Solicite a credencial da equipe de Manutenção.");
      setLoginPasswordInput(''); // Limpa a senha errada
      return;
    }

    if (loginNameInput.trim().length > 2) {
      const name = loginNameInput.trim();
      setCurrentUser(name);
      localStorage.setItem('gol_current_user', name);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginPasswordInput(''); // Limpa senha ao sair
    localStorage.removeItem('gol_current_user');
  };

  // Logic for scan and registration
  const cleanScanCode = (input: string): string => {
    const numericOnly = input.replace(/\D/g, ''); 
    return numericOnly.length > 9 ? numericOnly.slice(-9) : numericOnly;
  };

  useEffect(() => {
    const rawInput = scanInput.trim();
    if (!rawInput) return;
    const code = cleanScanCode(rawInput);
    if (code.length === 9) {
      const isRTA = code.startsWith('100') || code.startsWith('101');
      const isFAR = code.startsWith('200');
      if (isRTA || isFAR) {
        const timer = setTimeout(() => registerDocument(code), 300);
        return () => clearTimeout(timer);
      }
    }
  }, [scanInput]);

  const registerDocument = (code: string) => {
    const existing = documents.find(d => d.id === code);
    if (existing) {
       setScanInput(''); 
       setSearchTerm(code);
       return;
    }

    let docType = code.startsWith('200') ? 'FAR' : 'RTA';

    const newDoc: DocumentItem = {
      id: code,
      type: docType,
      status: DocStatus.CONFERENCE,
      hasErrors: false,
      errorCount: 0,
      createdBy: currentUser || 'Desconhecido',
      createdAt: new Date().toISOString(),
      logs: [{
        timestamp: new Date().toISOString(),
        action: 'Cadastrado na base centralizada',
        user: currentUser || 'Sistema'
      }]
    };

    setDocuments(prev => [newDoc, ...prev]);
    setScanInput(''); 
  };

  const updateStatus = (id: string, newStatus: DocStatus) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id !== id) return doc;
      const newLog: DocLog = {
        timestamp: new Date().toISOString(),
        action: `Status: ${STATUS_LABELS[newStatus]}`,
        user: currentUser || 'Operador'
      };
      return { ...doc, status: newStatus, logs: [newLog, ...doc.logs] };
    }));
  };

  const toggleError = (id: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id !== id) return doc;
      const hasErrors = !doc.hasErrors;
      const newStatus = hasErrors ? DocStatus.RETURN : doc.status;
      const newLog: DocLog = {
        timestamp: new Date().toISOString(),
        action: hasErrors ? 'Erro reportado' : 'Erro corrigido',
        user: currentUser || 'Conferente'
      };
      return { ...doc, hasErrors, errorCount: hasErrors ? doc.errorCount + 1 : doc.errorCount, status: newStatus, logs: [newLog, ...doc.logs] };
    }));
  };

  const deleteDocument = (id: string) => {
    if (confirm('Atenção: Você está excluindo este documento da BASE CENTRAL. Todos os usuários deixarão de vê-lo. Continuar?')) {
      setDocuments(prev => prev.filter(d => d.id !== id));
    }
  };

  const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  };

  const filteredDocs = documents.filter(doc => {
    const term = normalizeText(searchTerm.trim());
    const matchesSearch = !term || 
                          normalizeText(doc.id).includes(term) || 
                          normalizeText(doc.type).includes(term) ||
                          (doc.createdBy && normalizeText(doc.createdBy).includes(term)) ||
                          normalizeText(STATUS_LABELS[doc.status]).includes(term);
    
    let matchesDate = true;
    if (dateStart || dateEnd) {
      const docDate = new Date(doc.createdAt);
      const docMidnight = new Date(docDate.getFullYear(), docDate.getMonth(), docDate.getDate()).getTime();
      if (dateStart) {
        const [y, m, d] = dateStart.split('-').map(Number);
        const startTimestamp = new Date(y, m - 1, d).getTime();
        if (docMidnight < startTimestamp) matchesDate = false;
      }
      if (dateEnd) {
        const [y, m, d] = dateEnd.split('-').map(Number);
        const endTimestamp = new Date(y, m - 1, d).getTime();
        if (docMidnight > endTimestamp) matchesDate = false;
      }
    }

    let matchesStatus = true;
    if (statusFilter) {
      if (statusFilter === DocStatus.SHIPPING) {
        // Exibe tanto em envio quanto concluídos no filtro de funil
        matchesStatus = doc.status === DocStatus.SHIPPING || doc.status === DocStatus.COMPLETED;
      } else {
        matchesStatus = doc.status === statusFilter;
      }
    }
    return matchesSearch && matchesDate && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Sincronizando Base GOL...</h2>
        <p className="text-gray-500">Buscando as últimas atualizações da equipe.</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-orange-500">
           <img src="https://i.imgur.com/7XiGPwH.png" alt="GOL" className="h-16 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">GOL DOCS BSB</h2>
            <p className="text-gray-500 mb-6 font-medium">Controle de Documentação Centralizado</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Campo Nome */}
              <div className="text-left">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Colaborador</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <input 
                    type="text" 
                    value={loginNameInput}
                    onChange={(e) => setLoginNameInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-medium text-gray-800"
                    placeholder="Nome Completo"
                    required
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="text-left">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Senha de Acesso</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <input 
                    type="password" 
                    value={loginPasswordInput}
                    onChange={(e) => setLoginPasswordInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-medium text-gray-800"
                    placeholder="Senha da Equipe"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-orange-500 text-white font-bold py-3 rounded-lg hover:bg-orange-600 transition shadow-lg shadow-orange-200 mt-2">
                Acessar Base de Dados
              </button>
            </form>
            
            <p className="mt-4 text-xs text-gray-400">Área restrita à manutenção GOL BSB</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white shadow-md sticky top-0 z-40 border-b-4 border-orange-500">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4 sm:gap-6">
            <img src="https://i.imgur.com/7XiGPwH.png" alt="GOL" className="h-10 w-auto object-contain" />
            <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
            <div className="hidden xs:block">
              <h1 className="text-lg font-bold text-gray-800 leading-none">BSB DOCS</h1>
              <div className="flex items-center gap-1.5 mt-1">
                 {isSyncing ? (
                   <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
                 ) : syncError ? (
                   <CloudOff className="w-3 h-3 text-red-500" />
                 ) : (
                   <CloudCheck className="w-3 h-3 text-green-500" />
                 )}
                 <span className={`text-[9px] font-extrabold uppercase ${syncError ? 'text-red-500' : 'text-gray-400'}`}>
                   {isSyncing ? 'Salvando Alterações...' : syncError ? 'Erro ao Sincronizar' : 'Base em Nuvem Conectada'}
                 </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => loadData()} 
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold transition border border-gray-200"
              title="Atualizar dados de outros usuários"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar Base</span>
            </button>

            <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
              <User className="w-3 h-3 text-orange-500" />
              <span className="text-xs font-bold text-orange-700 max-w-[80px] sm:max-w-none truncate">{currentUser}</span>
            </div>
            
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition" title="Sair do Sistema">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
        <Infographic documents={documents} activeFilter={statusFilter} onFilterStatus={setStatusFilter} />

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="w-full lg:w-1/3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Leitor de Documento (RTA/FAR)</label>
            <div className="relative group">
              <Barcode className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
              <input
                type="text"
                autoFocus
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-orange-500 sm:text-lg transition-all font-mono"
                placeholder="Escaneie o código de barras..."
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                 <ShieldCheck className="w-4 h-4 text-green-500 mr-2" />
                 <span className="text-[10px] font-bold bg-white text-gray-500 px-2 py-1 rounded-lg border shadow-sm">9 DÍGITOS</span>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-2/3 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex gap-2 w-full md:w-auto">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Data Início</label>
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Data Fim</label>
                <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Busca Global</label>
              <div className="relative">
                <Filter className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium" 
                  placeholder="Código, status ou colaborador..." 
                />
                {statusFilter && (
                  <button onClick={() => setStatusFilter(null)} className="absolute inset-y-0 right-2 flex items-center text-[10px] text-orange-600 font-black hover:underline uppercase tracking-tighter">
                    Limpar Filtro
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Database className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-800">Repositório BSB</h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Sincronizado em tempo real</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {statusFilter && (
                <span className="bg-orange-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-sm uppercase">
                  Exibindo: {STATUS_LABELS[statusFilter]} {statusFilter === DocStatus.SHIPPING ? '+ CONCLUÍDOS' : ''}
                </span>
              )}
              <span className="text-xs font-black text-gray-400 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
                {filteredDocs.length} REGISTROS
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Documento</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Atual</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Criado Por</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Erros</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Ações de Fluxo</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Gestão</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredDocs.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-medium">Nenhum documento encontrado na base central com os filtros aplicados.</td></tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-orange-50/30 transition-colors group">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center font-black text-[10px] shadow-sm ${doc.type === 'RTA' ? 'bg-blue-600 text-white' : doc.type === 'FAR' ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-white'}`}>
                            {doc.type}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-black text-gray-900 group-hover:text-orange-600 transition-colors">{doc.id}</div>
                            <div className="text-[10px] font-bold text-gray-400">{new Date(doc.createdAt).toLocaleDateString()} {new Date(doc.createdAt).toLocaleTimeString()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                         <div className="flex flex-col gap-1.5">
                           <StatusBadge status={doc.status} />
                           {doc.hasErrors && <span className="text-[10px] font-black text-red-600 flex items-center gap-1 uppercase"><AlertCircle className="w-3 h-3"/> Em Correção</span>}
                         </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className="text-xs font-bold text-gray-600 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 border border-gray-200">
                            {doc.createdBy.charAt(0).toUpperCase()}
                          </div>
                          {doc.createdBy}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className={`text-xs font-black ${doc.errorCount > 0 ? 'text-red-500 bg-red-50 px-2 py-1 rounded-lg inline-block border border-red-100' : 'text-gray-300'}`}>{doc.errorCount}</div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                           {doc.status === DocStatus.CONFERENCE && (
                             <>
                              <button onClick={() => toggleError(doc.id)} className={`px-3 py-2 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${doc.hasErrors ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-500 border-gray-100 hover:border-red-500 hover:text-red-600 shadow-sm'}`}>
                                {doc.hasErrors ? 'ERRO ATIVO' : 'RELATAR ERRO'}
                              </button>
                              {!doc.hasErrors && <button onClick={() => updateStatus(doc.id, DocStatus.SCANNER)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-100">LIBERAR <ArrowRight className="w-3 h-3" /></button>}
                             </>
                           )}
                           {doc.status === DocStatus.RETURN && (
                             <button onClick={() => { toggleError(doc.id); updateStatus(doc.id, DocStatus.CONFERENCE); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-700 shadow-lg shadow-green-100">
                               <CheckCircle2 className="w-3 h-3" /> CONFIRMAR CORREÇÃO
                             </button>
                           )}
                           {doc.status === DocStatus.SCANNER && (
                             <button onClick={() => updateStatus(doc.id, DocStatus.ACCEPTANCE)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-purple-700 shadow-lg shadow-purple-100">DIGITALIZADO <ArrowRight className="w-3 h-3" /></button>
                           )}
                           {doc.status === DocStatus.ACCEPTANCE && (
                             <button onClick={() => updateStatus(doc.id, DocStatus.SHIPPING)} className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-yellow-600 shadow-lg shadow-yellow-100">ACEITE RECEBIDO <ArrowRight className="w-3 h-3" /></button>
                           )}
                           {doc.status === DocStatus.SHIPPING && (
                             <button onClick={() => updateStatus(doc.id, DocStatus.COMPLETED)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-orange-700 shadow-lg shadow-orange-100">FINALIZAR C.I. <CheckCircle2 className="w-3 h-3" /></button>
                           )}
                           {doc.status === DocStatus.COMPLETED && (
                             <div className="flex items-center gap-1.5 text-green-600 font-black text-[10px] uppercase bg-green-50 px-3 py-2 rounded-xl border border-green-100">
                               <CheckCircle2 className="w-3 h-3" /> Processo Encerrado
                             </div>
                           )}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        <div className="flex items-center gap-2 justify-end">
                           <button onClick={() => setViewingLogsDocId(doc.id)} className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl border border-transparent hover:border-blue-200 transition-all" title="Ver Histórico/Logs">
                             <History className="w-4 h-4" />
                           </button>
                          <button onClick={() => deleteDocument(doc.id)} className="p-2.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Excluir da Base Central"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL DE LOGS */}
      {viewingLogsDocId && (
        <LogViewer 
          document={documents.find(d => d.id === viewingLogsDocId)!} 
          onClose={() => setViewingLogsDocId(null)} 
        />
      )}
    </div>
  );
}

export default App;