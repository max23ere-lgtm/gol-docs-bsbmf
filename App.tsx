import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Barcode, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  ArrowRight,
  History,
  Camera,
  User,
  LogOut,
  Filter,
  ShieldCheck,
  CloudCheck,
  CloudOff,
  RefreshCw,
  Loader2,
  Database,
  Lock,
  Moon,
  Sun,
  X,
  ScanLine,
  PieChart
} from 'lucide-react';
import { DocumentItem, DocStatus, DocLog, STATUS_LABELS } from './types';
import { StatusBadge } from './components/StatusBadge';
import { Infographic } from './components/Infographic';
import { LogViewer } from './components/LogViewer';
import { StatsModal } from './components/StatsModal';
import { dbService } from './services/dbService';
import { extractDataFromImage } from './services/geminiService';

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
  const [isDeleting, setIsDeleting] = useState(false);
  
  // UI State
  const [scanInput, setScanInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingLogsDocId, setViewingLogsDocId] = useState<string | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Dark Mode
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('gol_theme') === 'dark';
  });

  // Camera State
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Filters
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocStatus | null>(null);

  // --- DARK MODE LOGIC ---
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('gol_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('gol_theme', 'light');
    }
  }, [darkMode]);

  // --- CARREGAMENTO DE DADOS ---
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

  // --- SINCRONIZAÇÃO AUTOMÁTICA ---
  const dataLoaded = useRef(false);
  useEffect(() => {
    if (isLoading || isDeleting) return; 
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
    }, 1500);

    return () => clearTimeout(timer);
  }, [documents, isLoading, isDeleting]);

  // --- HANDLERS DE LOGIN ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginPasswordInput !== SHARED_ACCESS_KEY) {
      alert("Senha de acesso incorreta.");
      setLoginPasswordInput('');
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
    setLoginPasswordInput('');
    localStorage.removeItem('gol_current_user');
  };

  // --- LÓGICA DE REGISTRO E SCANNER ---
  const cleanScanCode = (input: string): string => {
    const numericOnly = input.replace(/\D/g, ''); 
    // Se for muito longo, pega os últimos 9 dígitos, mas permite menor para validação manual
    return numericOnly.length > 9 ? numericOnly.slice(-9) : numericOnly;
  };

  const registerDocument = (code: string) => {
    const cleanCode = cleanScanCode(code);
    
    // Validação básica para evitar lixo
    if (cleanCode.length < 5) return false;

    const existing = documents.find(d => d.id === cleanCode);
    if (existing) {
       // Se já existe, apenas foca na busca
       setScanInput(''); 
       setSearchTerm(cleanCode); 
       // Feedback visual se possível (shake effect ou toast - simplificado aqui)
       return true; // Retorna true para sinalizar que "processou"
    }

    let docType = cleanCode.startsWith('200') ? 'FAR' : 'RTA';

    const newDoc: DocumentItem = {
      id: cleanCode,
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
    return true;
  };

  // Monitora input manual (scanner de mão USB ou digitação)
  useEffect(() => {
    const rawInput = scanInput.trim();
    if (!rawInput) return;
    
    // Tenta identificar padrões automaticamente enquanto digita
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

  // --- CÂMERA ---
  const startCamera = async () => {
    setShowCamera(true);
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Importante para iOS não bloquear o play
        videoRef.current.setAttribute('playsinline', 'true');
      }
    } catch (err) {
      setCameraError('Erro ao acessar a câmera. Verifique permissões no navegador.');
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current) return;
    setIsCameraLoading(true);
    setCameraError(''); // Limpa erros anteriores
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');
        
        const code = await extractDataFromImage(base64);
        
        if (code) {
          // SUCESSO! Inserir automaticamente.
          if (navigator.vibrate) navigator.vibrate(200); // Feedback tátil
          
          const registered = registerDocument(code);
          
          if (registered) {
             stopCamera();
             // Opcional: Adicionar um Toast de sucesso aqui se tivesse componente de Toast
          } else {
             setCameraError(`Código lido (${code}) parece inválido.`);
          }
        } else {
          setCameraError('Nenhum código válido identificado na imagem. Tente aproximar.');
        }
      }
    } catch (err) {
      setCameraError('Erro técnico ao processar imagem.');
    } finally {
      setIsCameraLoading(false);
    }
  };

  // --- AÇÕES ---
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

  const deleteDocument = async (id: string) => {
    if (confirm('Atenção: Você está excluindo este documento da BASE CENTRAL. Continuar?')) {
      setIsDeleting(true); 
      setDocuments(prev => prev.filter(d => d.id !== id));
      const success = await dbService.deleteDocument(id);
      setIsDeleting(false);
      if (!success) {
        alert("Erro ao excluir do banco de dados. Tente recarregar a página.");
        loadData(true);
      }
    }
  };

  // --- FILTROS ---
  const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

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
    
    if (statusFilter) {
      if (statusFilter === DocStatus.SHIPPING) {
        if (doc.status !== DocStatus.SHIPPING && doc.status !== DocStatus.COMPLETED) {
          return false;
        }
      } else if (doc.status !== statusFilter) {
        return false;
      }
    }

    return matchesSearch && matchesDate;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-16 h-16 text-orange-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Carregando Sistema...</h2>
      </div>
    );
  }

  // --- TELA DE LOGIN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-center transition-colors">
        <div className="bg-white dark:bg-zinc-900 p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-zinc-800 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-orange-600"></div>
           
           <div className="bg-white rounded-xl p-4 inline-block mb-6 shadow-sm">
             <img src="https://i.imgur.com/7XiGPwH.png" alt="GOL" className="h-12 w-auto object-contain" />
           </div>
           
            <h2 className="text-3xl font-black text-gray-800 dark:text-white mb-2 tracking-tight">GOL DOCS BSB</h2>
            <p className="text-gray-500 dark:text-zinc-400 mb-8 font-medium text-sm">Controle de Manutenção Centralizado</p>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="text-left group">
                <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1 ml-1 group-focus-within:text-orange-500 transition-colors">Colaborador</label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 text-gray-400 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />
                  <input type="text" value={loginNameInput} onChange={(e) => setLoginNameInput(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl focus:border-orange-500 outline-none font-bold text-gray-700 transition-all placeholder-gray-300 dark:placeholder-zinc-600" placeholder="Nome Completo" required />
                </div>
              </div>
              <div className="text-left group">
                <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1 ml-1 group-focus-within:text-orange-500 transition-colors">Senha de Acesso</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-gray-400 w-5 h-5 group-focus-within:text-orange-500 transition-colors" />
                  <input type="password" value={loginPasswordInput} onChange={(e) => setLoginPasswordInput(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl focus:border-orange-500 outline-none font-bold text-gray-700 transition-all placeholder-gray-300 dark:placeholder-zinc-600" placeholder="Senha da Equipe" required />
                </div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 mt-4 active:scale-95">ACESSAR BASE DE DADOS</button>
            </form>
        </div>
      </div>
    );
  }

  // --- TELA PRINCIPAL ---
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-500 text-gray-800 dark:text-gray-100">
      
      {/* HEADER */}
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200 dark:border-zinc-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="bg-white p-1.5 rounded-lg shadow-sm border border-gray-100">
              <img src="https://i.imgur.com/7XiGPwH.png" alt="GOL" className="h-6 w-auto object-contain" />
            </div>
            <div className="hidden xs:block border-l pl-4 border-gray-200 dark:border-zinc-700">
              <h1 className="text-lg font-black text-gray-800 dark:text-white leading-none tracking-tight">BSB DOCS</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                 {isSyncing ? (
                   <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
                 ) : syncError ? (
                   <CloudOff className="w-3 h-3 text-red-500" />
                 ) : (
                   <CloudCheck className="w-3 h-3 text-green-500" />
                 )}
                 <span className={`text-[10px] font-bold uppercase tracking-wide ${syncError ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500'}`}>
                   {isSyncing ? 'Sincronizando...' : syncError ? 'Offline' : 'Online'}
                 </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowStatsModal(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-500/20 active:scale-95"
            >
               <PieChart className="w-4 h-4" />
               Relatórios
            </button>

            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-all border border-transparent hover:border-gray-200 dark:hover:border-zinc-700">
               {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5" />}
            </button>

            <button onClick={() => loadData()} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all border border-transparent dark:border-zinc-700" title="Atualizar">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-500/10 px-3 py-2 rounded-xl border border-orange-100 dark:border-orange-500/20">
              <User className="w-3.5 h-3.5 text-orange-600 dark:text-orange-500" />
              <span className="text-xs font-bold text-orange-700 dark:text-orange-400 max-w-[80px] truncate">{currentUser}</span>
            </div>
            
            <button onClick={handleLogout} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all" title="Sair">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
        
        <Infographic documents={documents} activeFilter={statusFilter} onFilterStatus={setStatusFilter} />

        {/* PAINEL DE COMANDO */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-zinc-800 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between transition-colors">
          <div className="w-full lg:w-1/3">
            <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 ml-1">Scanner Inteligente</label>
            <div className="flex gap-3">
              <div className="relative flex-1 group">
                <ScanLine className="absolute left-4 top-4 h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                <input 
                  type="text" 
                  autoFocus 
                  value={scanInput} 
                  onChange={(e) => setScanInput(e.target.value)} 
                  className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-100 dark:border-zinc-700 rounded-2xl bg-gray-50 dark:bg-zinc-800 placeholder-gray-400 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-orange-500 sm:text-base transition-all font-mono font-medium shadow-inner" 
                  placeholder="Código de Barras / WO" 
                />
              </div>
              <button 
                onClick={startCamera}
                className="px-5 bg-gray-900 dark:bg-zinc-700 text-white rounded-2xl hover:bg-orange-600 dark:hover:bg-orange-600 transition-colors shadow-lg hover:shadow-orange-500/30 active:scale-95 flex items-center justify-center"
                title="Abrir Câmera IA"
              >
                <Camera className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="w-full lg:w-2/3 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-2 ml-1">Início</label>
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="w-full border-2 border-gray-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl px-4 py-3 text-sm font-medium focus:border-orange-500 outline-none transition-all" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-2 ml-1">Fim</label>
                <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="w-full border-2 border-gray-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl px-4 py-3 text-sm font-medium focus:border-orange-500 outline-none transition-all" />
              </div>
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-2 ml-1">Busca Global</label>
              <div className="relative">
                <Filter className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-11 pr-4 py-3 border-2 border-gray-100 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 focus:border-orange-500 outline-none text-sm font-medium transition-all dark:text-white" placeholder="Pesquisar..." />
                {statusFilter && (
                  <button onClick={() => setStatusFilter(null)} className="absolute inset-y-0 right-3 flex items-center text-[10px] text-orange-600 font-bold hover:underline uppercase tracking-tight">Limpar</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TABELA DE DADOS */}
        <div className="bg-white dark:bg-zinc-900 shadow-xl shadow-gray-200/50 dark:shadow-none rounded-3xl overflow-hidden border border-gray-100 dark:border-zinc-800 transition-colors">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-500/20 rounded-lg">
                <Database className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Repositório BSB</h2>
            </div>
            <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-gray-100 dark:border-zinc-700">{filteredDocs.length} Resultados</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-zinc-800">
              <thead className="hidden md:table-header-group bg-gray-50/50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Documento</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Autor</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Alertas</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Fluxo</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Opções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                {filteredDocs.length === 0 ? (
                  <tr><td colSpan={6} className="px-8 py-16 text-center text-gray-400 dark:text-zinc-600 font-medium">Nenhum registro encontrado.</td></tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-orange-50/30 dark:hover:bg-zinc-800/50 transition-colors group flex flex-col md:table-row p-6 md:p-0 border-b md:border-none">
                      
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center font-bold text-[10px] shadow-sm ${doc.type === 'RTA' ? 'bg-blue-600 text-white' : doc.type === 'FAR' ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-white'}`}>
                            {doc.type}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900 dark:text-white font-mono group-hover:text-orange-600 transition-colors">{doc.id}</div>
                            <div className="text-[10px] font-medium text-gray-400 dark:text-zinc-500">{new Date(doc.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-8 py-5 whitespace-nowrap">
                         <div className="flex flex-col gap-1.5 items-start">
                           <StatusBadge status={doc.status} />
                           {doc.hasErrors && <span className="text-[9px] font-black text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/30 uppercase tracking-wide">Em Correção</span>}
                         </div>
                      </td>

                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] border border-gray-200 dark:border-zinc-700 font-bold">{doc.createdBy.charAt(0).toUpperCase()}</div>
                          {doc.createdBy.split(' ')[0]}
                        </span>
                      </td>

                      <td className="px-8 py-5 whitespace-nowrap">
                        {doc.errorCount > 0 ? (
                          <div className="flex items-center gap-1 text-red-500 text-xs font-bold">
                             <AlertCircle className="w-3.5 h-3.5" /> {doc.errorCount}
                          </div>
                        ) : (
                          <div className="text-gray-300 dark:text-zinc-700 text-xs">-</div>
                        )}
                      </td>

                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2 flex-wrap">
                           {doc.status === DocStatus.CONFERENCE && (
                             <>
                              <button onClick={() => toggleError(doc.id)} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all ${doc.hasErrors ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-red-500 hover:text-red-500'}`}>{doc.hasErrors ? 'Erro Ativo' : 'Reportar'}</button>
                              {!doc.hasErrors && <button onClick={() => updateStatus(doc.id, DocStatus.SCANNER)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-700 shadow-md shadow-indigo-500/20">Liberar <ArrowRight className="w-3 h-3" /></button>}
                             </>
                           )}
                           {doc.status === DocStatus.RETURN && (
                             <button onClick={() => { toggleError(doc.id); updateStatus(doc.id, DocStatus.CONFERENCE); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-green-700 shadow-md shadow-green-500/20"><CheckCircle2 className="w-3 h-3" /> Corrigido</button>
                           )}
                           {doc.status === DocStatus.SCANNER && (
                             <button onClick={() => updateStatus(doc.id, DocStatus.ACCEPTANCE)} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-purple-700 shadow-md shadow-purple-500/20">Digitalizado <ArrowRight className="w-3 h-3" /></button>
                           )}
                           {doc.status === DocStatus.ACCEPTANCE && (
                             <button onClick={() => updateStatus(doc.id, DocStatus.SHIPPING)} className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-yellow-600 shadow-md shadow-yellow-500/20">Aceitar <ArrowRight className="w-3 h-3" /></button>
                           )}
                           {doc.status === DocStatus.SHIPPING && (
                             <button onClick={() => updateStatus(doc.id, DocStatus.COMPLETED)} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-orange-700 shadow-md shadow-orange-500/20">Finalizar <CheckCircle2 className="w-3 h-3" /></button>
                           )}
                           {doc.status === DocStatus.COMPLETED && (
                             <span className="flex items-center gap-1 text-green-600 dark:text-green-500 font-bold text-[10px] uppercase bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded border border-green-100 dark:border-green-900/30"><CheckCircle2 className="w-3 h-3" /> OK</span>
                           )}
                        </div>
                      </td>

                      <td className="px-8 py-5 whitespace-nowrap text-right">
                        <div className="flex items-center gap-1 justify-end">
                           <button onClick={() => setViewingLogsDocId(doc.id)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="Histórico"><History className="w-4 h-4" /></button>
                          <button onClick={() => deleteDocument(doc.id)} className="p-2 text-gray-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="Excluir"><Trash2 className="w-4 h-4" /></button>
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

      <footer className="border-t border-gray-200 dark:border-zinc-800 py-8 mt-8 bg-white dark:bg-zinc-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500 dark:text-zinc-500 gap-4">
          <div className="font-medium">
            © {new Date().getFullYear()} GOL Linhas Aéreas - Manutenção BSB
          </div>
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-gray-100 dark:border-zinc-700">
            Desenvolvido por <strong className="text-orange-600 dark:text-orange-500">José Augusto Torres</strong> • <a href="mailto:jatgsilva@voegol.com.br" className="hover:text-orange-500 underline transition-colors">jatgsilva@voegol.com.br</a>
          </div>
        </div>
      </footer>

      {/* MODAL DE LOGS */}
      {viewingLogsDocId && (
        <LogViewer document={documents.find(d => d.id === viewingLogsDocId)!} onClose={() => setViewingLogsDocId(null)} />
      )}

      {/* MODAL DE ESTATÍSTICAS */}
      {showStatsModal && (
        <StatsModal documents={documents} onClose={() => setShowStatsModal(false)} />
      )}

      {/* MODAL DA CÂMERA (IA) */}
      {showCamera && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="absolute top-6 right-6 z-50">
            <button onClick={stopCamera} className="bg-zinc-800/80 p-3 rounded-full text-white hover:bg-zinc-700 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="w-full h-full relative flex items-center justify-center bg-black">
            {/* Added playsInline and muted for iOS compatibility */}
            <video ref={videoRef} autoPlay playsInline muted className="max-w-full max-h-full object-cover opacity-90" />
            
            {/* Overlay de Scan */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-48 border-2 border-orange-500/80 rounded-2xl relative shadow-[0_0_100px_rgba(249,115,22,0.3)]">
                 <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-orange-500 -mt-0.5 -ml-0.5 rounded-tl-lg"></div>
                 <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-orange-500 -mt-0.5 -mr-0.5 rounded-tr-lg"></div>
                 <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-orange-500 -mb-0.5 -ml-0.5 rounded-bl-lg"></div>
                 <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-orange-500 -mb-0.5 -mr-0.5 rounded-br-lg"></div>
                 
                 {/* Laser Effect */}
                 <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse"></div>
              </div>
            </div>

            {/* Loading Overlay */}
            {isCameraLoading && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                <Loader2 className="w-16 h-16 text-orange-500 animate-spin mb-6" />
                <p className="text-white font-bold text-2xl tracking-tight">IA Analisando...</p>
                <p className="text-zinc-400 text-sm mt-2">Extraindo dados do documento</p>
              </div>
            )}
          </div>
          
          <div className="absolute bottom-12 w-full flex flex-col items-center gap-6 z-50 px-6">
            {cameraError && (
              <div className="bg-red-500/90 backdrop-blur text-white px-6 py-3 rounded-xl text-sm font-bold shadow-xl animate-bounce">
                {cameraError}
              </div>
            )}
            <p className="text-white/80 text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
              Aponte para o documento e toque no botão central
            </p>
            <button 
              onClick={captureAndAnalyze}
              disabled={isCameraLoading}
              className="w-20 h-20 rounded-full bg-white border-4 border-zinc-200 flex items-center justify-center shadow-2xl active:scale-95 transition-transform hover:border-orange-500 group"
            >
              <div className="w-16 h-16 bg-orange-600 rounded-full group-hover:scale-90 transition-transform flex items-center justify-center">
                 <Camera className="w-8 h-8 text-white" />
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;