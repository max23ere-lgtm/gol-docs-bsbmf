
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Barcode, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  ArrowRight,
  ArrowLeft,
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
  PieChart,
  WifiOff,
  Calendar,
  Clock
} from 'lucide-react';
import { DocumentItem, DocStatus, DocLog, STATUS_LABELS } from './types';
import { StatusBadge } from './components/StatusBadge';
import { Infographic } from './components/Infographic';
import { LogViewer } from './components/LogViewer';
import { StatsModal } from './components/StatsModal';
import { dbService } from './services/dbService';
import { extractDataFromImage } from './services/geminiService';

const SHARED_ACCESS_KEY = 'JGOL@BSBMFCDT$';

function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('gol_current_user'));
  const [loginNameInput, setLoginNameInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isFirstLoadDone = useRef(false);
  
  const [scanInput, setScanInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingLogsDocId, setViewingLogsDocId] = useState<string | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('gol_theme') === 'dark');

  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocStatus | null>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('gol_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('gol_theme', 'light');
    }
  }, [darkMode]);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await dbService.fetchDocuments();
      setDocuments(data);
      setSyncError(false);
      isFirstLoadDone.current = true;
    } catch (err) {
      setSyncError(true);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isFirstLoadDone.current || isLoading || isDeleting) return;

    const timer = setTimeout(async () => {
      setIsSyncing(true);
      const success = await dbService.saveDocuments(documents);
      setIsSyncing(false);
      setSyncError(!success);
    }, 2000);

    return () => clearTimeout(timer);
  }, [documents, isLoading, isDeleting]);

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

  const cleanScanCode = (input: string): string => {
    const numericOnly = input.replace(/\D/g, ''); 
    return numericOnly.length > 9 ? numericOnly.slice(-9) : numericOnly;
  };

  const registerDocument = (code: string) => {
    const cleanCode = cleanScanCode(code);
    if (cleanCode.length < 5) return false;

    const existing = documents.find(d => d.id === cleanCode);
    if (existing) {
       setScanInput(''); 
       setSearchTerm(cleanCode); 
       return true;
    }

    let docType = cleanCode.startsWith('200') ? 'FAR' : 'RTA';
    const now = new Date().toISOString();
    const newDoc: DocumentItem = {
      id: cleanCode,
      type: docType,
      status: DocStatus.CONFERENCE,
      hasErrors: false,
      errorCount: 0,
      createdBy: currentUser || 'Desconhecido',
      createdAt: now,
      originalDate: now,
      logs: [{
        timestamp: now,
        action: 'Cadastrado na base centralizada',
        user: currentUser || 'Sistema'
      }]
    };

    setDocuments(prev => [newDoc, ...prev]);
    setScanInput(''); 
    return true;
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

  const startCamera = async () => {
    setShowCamera(true);
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
      }
    } catch (err) {
      setCameraError('Erro ao acessar a câmera. Verifique as permissões.');
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
    setCameraError('');
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
          if (navigator.vibrate) navigator.vibrate(200);
          const registered = registerDocument(code);
          if (registered) stopCamera();
          else setCameraError(`Código inválido: ${code}`);
        } else {
          setCameraError('Não foi possível ler o código. Tente novamente.');
        }
      }
    } catch (err) {
      setCameraError('Erro ao processar imagem.');
    } finally {
      setIsCameraLoading(false);
    }
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

  const updateDocField = (id: string, field: keyof DocumentItem, value: any) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id !== id) return doc;
      return { ...doc, [field]: value };
    }));
  };

  const getPrevStatus = (currentStatus: DocStatus): DocStatus | null => {
    switch (currentStatus) {
      case DocStatus.SCANNER: return DocStatus.CONFERENCE;
      case DocStatus.ACCEPTANCE: return DocStatus.SCANNER;
      case DocStatus.SHIPPING: return DocStatus.ACCEPTANCE;
      case DocStatus.COMPLETED: return DocStatus.SHIPPING;
      default: return null;
    }
  };

  const revertStatus = (doc: DocumentItem) => {
    if (doc.hasErrors) {
      setDocuments(prev => prev.map(d => {
        if (d.id !== doc.id) return d;
        const newErrorCount = Math.max(0, d.errorCount - 1);
        const newLog: DocLog = {
          timestamp: new Date().toISOString(),
          action: 'Apontamento de erro cancelado (Undo)',
          user: currentUser || 'Supervisor'
        };
        return { 
          ...d, 
          status: DocStatus.CONFERENCE, 
          hasErrors: false, 
          errorCount: newErrorCount,
          logs: [newLog, ...d.logs] 
        };
      }));
      return;
    }

    if (doc.status === DocStatus.CONFERENCE && doc.errorCount > 0) {
      setDocuments(prev => prev.map(d => {
        if (d.id !== doc.id) return d;
        const newErrorCount = Math.max(0, d.errorCount - 1);
        const newLog: DocLog = {
          timestamp: new Date().toISOString(),
          action: 'Registro de erro removido do histórico',
          user: currentUser || 'Supervisor'
        };
        // Limpa a data de início da correção se o histórico for zerado
        const correctionDate = newErrorCount === 0 ? undefined : d.correctionStartedAt;
        return { 
          ...d, 
          errorCount: newErrorCount,
          correctionStartedAt: correctionDate,
          logs: [newLog, ...d.logs] 
        };
      }));
      return;
    }

    const prevStatus = getPrevStatus(doc.status);
    if (!prevStatus) return;

    setDocuments(prev => prev.map(d => {
      if (d.id !== doc.id) return d;
      const newLog: DocLog = {
        timestamp: new Date().toISOString(),
        action: `Retorno de Etapa: ${STATUS_LABELS[prevStatus]}`,
        user: currentUser || 'Supervisor'
      };
      return { ...d, status: prevStatus, logs: [newLog, ...d.logs] };
    }));
  };

  const toggleError = (id: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id !== id) return doc;
      const hasErrors = !doc.hasErrors;
      const newStatus = hasErrors ? DocStatus.RETURN : doc.status;
      const now = new Date().toISOString();
      
      // Se é o primeiro erro, grava o início da correção
      const firstCorrectionDate = (!doc.correctionStartedAt && hasErrors) ? now : doc.correctionStartedAt;

      const newLog: DocLog = {
        timestamp: now,
        action: hasErrors ? 'Erro reportado' : 'Erro corrigido',
        user: currentUser || 'Conferente'
      };
      return { 
        ...doc, 
        hasErrors, 
        errorCount: hasErrors ? doc.errorCount + 1 : doc.errorCount, 
        status: newStatus, 
        correctionStartedAt: firstCorrectionDate,
        logs: [newLog, ...doc.logs] 
      };
    }));
  };

  const deleteDocument = async (id: string) => {
    const password = window.prompt("⚠️ AÇÃO DE SEGURANÇA\n\nEsta ação excluirá o documento permanentemente da base de dados.\n\nDigite a SENHA DE ACESSO para confirmar:");
    if (password === SHARED_ACCESS_KEY) {
      setIsDeleting(true); 
      setDocuments(prev => prev.filter(d => d.id !== id));
      await dbService.deleteDocument(id);
      setIsDeleting(false);
    } else if (password !== null) {
      alert("Senha incorreta. A exclusão foi cancelada.");
    }
  };

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
      const docDate = new Date(doc.originalDate || doc.createdAt);
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
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Sincronizando Base de Dados...</h2>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white dark:bg-zinc-900 p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-zinc-800 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-orange-600"></div>
           <div className="bg-white rounded-xl p-4 inline-block mb-6 shadow-sm">
             <img src="https://i.imgur.com/7XiGPwH.png" alt="GOL" className="h-12 w-auto object-contain" />
           </div>
            <h2 className="text-3xl font-black text-gray-800 dark:text-white mb-2 tracking-tight">GOL DOCS BSB</h2>
            <p className="text-gray-500 dark:text-zinc-400 mb-8 font-medium text-sm">Controle de Manutenção Centralizado</p>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="text-left">
                <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1 ml-1">Colaborador</label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                  <input type="text" value={loginNameInput} onChange={(e) => setLoginNameInput(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl focus:border-orange-500 outline-none font-bold" placeholder="Nome Completo" required />
                </div>
              </div>
              <div className="text-left">
                <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-1 ml-1">Senha de Acesso</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                  <input type="password" value={loginPasswordInput} onChange={(e) => setLoginPasswordInput(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-gray-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl focus:border-orange-500 outline-none font-bold" placeholder="Senha da Equipe" required />
                </div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-95">ACESSAR BASE DE DADOS</button>
            </form>
        </div>
      </div>
    );
  }

  const canRevert = (doc: DocumentItem) => {
    return getPrevStatus(doc.status) || doc.hasErrors || (doc.status === DocStatus.CONFERENCE && doc.errorCount > 0);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-500 text-gray-800 dark:text-gray-100">
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1.5 rounded-lg shadow-sm border border-gray-100">
              <img src="https://i.imgur.com/7XiGPwH.png" alt="GOL" className="h-6 w-auto object-contain" />
            </div>
            <div className="hidden xs:block border-l pl-4 border-gray-200 dark:border-zinc-700">
              <h1 className="text-lg font-black text-gray-800 dark:text-white leading-none tracking-tight">BSB DOCS</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                 {isSyncing ? <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" /> : syncError ? <WifiOff className="w-3 h-3 text-red-500" /> : <CloudCheck className="w-3 h-3 text-green-500" />}
                 <span className={`text-[10px] font-bold uppercase tracking-wide ${syncError ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500'}`}>{isSyncing ? 'Salvando...' : syncError ? 'Erro de Conexão' : 'Dados Sincronizados'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowStatsModal(true)} className="hidden sm:flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md"><PieChart className="w-4 h-4" /> Relatórios</button>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-all border dark:border-zinc-700">{darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5" />}</button>
            <button onClick={() => loadData()} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all border dark:border-zinc-700"><RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Atualizar</span></button>
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-500/10 px-3 py-2 rounded-xl border border-orange-100 dark:border-orange-500/20"><User className="w-3.5 h-3.5 text-orange-600 dark:text-orange-500" /><span className="text-xs font-bold text-orange-700 dark:text-orange-400 max-w-[80px] truncate">{currentUser}</span></div>
            <button onClick={handleLogout} className="p-2.5 text-gray-400 hover:text-red-500 rounded-xl transition-all"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        <Infographic documents={documents} activeFilter={statusFilter} onFilterStatus={setStatusFilter} />

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-zinc-800 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
          <div className="w-full lg:w-1/3">
            <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 ml-1">Scanner Inteligente</label>
            <div className="flex gap-3">
              <div className="relative flex-1 group">
                <ScanLine className="absolute left-4 top-4 h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                <input type="text" autoFocus value={scanInput} onChange={(e) => setScanInput(e.target.value)} className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-100 dark:border-zinc-700 rounded-2xl bg-gray-50 dark:bg-zinc-800 placeholder-gray-400 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-orange-500 sm:text-base transition-all font-mono font-medium shadow-inner" placeholder="Inserir Manual ou Scanner" />
              </div>
              <button onClick={startCamera} className="px-5 bg-gray-900 dark:bg-zinc-700 text-white rounded-2xl hover:bg-orange-600 transition-colors flex items-center justify-center"><Camera className="w-6 h-6" /></button>
            </div>
          </div>

          <div className="w-full lg:w-2/3 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-2 ml-1">Início</label>
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="w-full border-2 border-gray-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:border-orange-500 outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-2 ml-1">Fim</label>
                <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="w-full border-2 border-gray-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:border-orange-500 outline-none" />
              </div>
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-2 ml-1">Busca Global</label>
              <div className="relative">
                <Filter className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-11 pr-4 py-3 border-2 border-gray-100 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 focus:border-orange-500 outline-none text-sm font-medium dark:text-white" placeholder="Pesquisar..." />
                {statusFilter && <button onClick={() => setStatusFilter(null)} className="absolute inset-y-0 right-3 flex items-center text-[10px] text-orange-600 font-bold hover:underline uppercase tracking-tight">Limpar</button>}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 shadow-xl rounded-3xl overflow-hidden border border-gray-100 dark:border-zinc-800">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-500/20 rounded-lg"><Database className="w-5 h-5 text-orange-600 dark:text-orange-500" /></div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Repositório BSB</h2>
            </div>
            <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 rounded-full">{filteredDocs.length} Resultados</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-zinc-800">
              <thead className="hidden md:table-header-group bg-gray-50/50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Documento</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Autor</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Datas de Controle</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Fluxo</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Opções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                {filteredDocs.length === 0 ? (
                  <tr><td colSpan={6} className="px-8 py-16 text-center text-gray-400 dark:text-zinc-600">Nenhum registro encontrado.</td></tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-orange-50/30 dark:hover:bg-zinc-800/50 transition-colors group flex flex-col md:table-row">
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center font-bold text-[10px] ${doc.type === 'RTA' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'}`}>{doc.type}</div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900 dark:text-white font-mono">{doc.id}</div>
                            <div className="flex flex-col text-[9px] mt-1 space-y-0.5">
                               <div className="flex items-center gap-1 text-gray-400 font-bold uppercase tracking-tighter">
                                 <Calendar className="w-2.5 h-2.5" />
                                 Org: <input type="date" value={(doc.originalDate || doc.createdAt).split('T')[0]} onChange={(e) => updateDocField(doc.id, 'originalDate', new Date(e.target.value).toISOString())} className="bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-orange-500 font-mono" />
                               </div>
                               <div className="flex items-center gap-1 text-gray-300 font-medium">
                                 <Clock className="w-2.5 h-2.5" />
                                 Sis: {new Date(doc.createdAt).toLocaleDateString()}
                               </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                         <div className="flex flex-col gap-1.5 items-start">
                           <StatusBadge status={doc.status} />
                           {doc.hasErrors && <span className="text-[9px] font-black text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/30 uppercase">Em Correção</span>}
                         </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] border dark:border-zinc-700 font-bold">{doc.createdBy.charAt(0).toUpperCase()}</div>
                          {doc.createdBy.split(' ')[0]}
                        </span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                         <div className="flex flex-col gap-1.5">
                            {doc.errorCount > 0 ? (
                              <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-bold uppercase">
                                <AlertCircle className="w-3.5 h-3.5" /> 
                                {doc.errorCount} Erros
                              </div>
                            ) : (<div className="text-gray-300 dark:text-zinc-700 text-xs">-</div>)}
                            
                            {doc.correctionStartedAt && (
                               <div className="flex items-center gap-1 text-[9px] text-gray-500 dark:text-zinc-400 font-bold bg-gray-50 dark:bg-zinc-800 p-1 rounded border border-gray-100 dark:border-zinc-700">
                                 <Calendar className="w-2.5 h-2.5 text-orange-500" />
                                 Ini. Correção: 
                                 <input 
                                   type="date" 
                                   value={doc.correctionStartedAt.split('T')[0]} 
                                   onChange={(e) => updateDocField(doc.id, 'correctionStartedAt', new Date(e.target.value).toISOString())}
                                   className="bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-orange-500 ml-1"
                                 />
                               </div>
                            )}
                         </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2 flex-wrap">
                           {canRevert(doc) && <button onClick={() => revertStatus(doc)} className="p-1.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:text-orange-500 rounded-lg border border-gray-200 dark:border-zinc-700 transition-colors" title={doc.hasErrors ? "Desfazer Erro" : (doc.errorCount > 0 && doc.status === DocStatus.CONFERENCE ? "Limpar Histórico de Erros" : "Voltar Etapa Anterior")}><ArrowLeft className="w-3.5 h-3.5" /></button>}
                           {doc.status === DocStatus.CONFERENCE && (
                             <>
                              <button onClick={() => toggleError(doc.id)} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase ${doc.hasErrors ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700 hover:text-red-500'}`}>{doc.hasErrors ? 'Erro Ativo' : 'Reportar'}</button>
                              {!doc.hasErrors && <button onClick={() => updateStatus(doc.id, DocStatus.SCANNER)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase">Liberar <ArrowRight className="w-3 h-3" /></button>}
                             </>
                           )}
                           {doc.status === DocStatus.RETURN && <button onClick={() => { toggleError(doc.id); updateStatus(doc.id, DocStatus.CONFERENCE); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-bold uppercase"><CheckCircle2 className="w-3 h-3" /> Corrigido</button>}
                           {doc.status === DocStatus.SCANNER && <button onClick={() => updateStatus(doc.id, DocStatus.ACCEPTANCE)} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-[10px] font-bold uppercase">Digitalizado <ArrowRight className="w-3 h-3" /></button>}
                           {doc.status === DocStatus.ACCEPTANCE && <button onClick={() => updateStatus(doc.id, DocStatus.SHIPPING)} className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-[10px] font-bold uppercase">Aceitar <ArrowRight className="w-3 h-3" /></button>}
                           {doc.status === DocStatus.SHIPPING && <button onClick={() => updateStatus(doc.id, DocStatus.COMPLETED)} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-[10px] font-bold uppercase">Finalizar <CheckCircle2 className="w-3 h-3" /></button>}
                           {doc.status === DocStatus.COMPLETED && <span className="flex items-center gap-1 text-green-600 dark:text-green-500 font-bold text-[10px] uppercase bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded border border-green-100 dark:border-green-900/30"><CheckCircle2 className="w-3 h-3" /> OK</span>}
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-right">
                        <div className="flex items-center gap-1 justify-end">
                           <button onClick={() => setViewingLogsDocId(doc.id)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"><History className="w-4 h-4" /></button>
                          <button onClick={() => deleteDocument(doc.id)} className="p-2 text-gray-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="Excluir (Requer Senha)"><Trash2 className="w-4 h-4" /></button>
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
          <div className="font-medium">© {new Date().getFullYear()} GOL Linhas Aéreas - Manutenção BSB</div>
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 rounded-full border dark:border-zinc-700">Desenvolvido por <strong className="text-orange-600 dark:text-orange-500">José Augusto Torres</strong> • <a href="mailto:jatgsilva@voegol.com.br" className="hover:text-orange-500 underline">jatgsilva@voegol.com.br</a></div>
        </div>
      </footer>

      {viewingLogsDocId && <LogViewer document={documents.find(d => d.id === viewingLogsDocId)!} onClose={() => setViewingLogsDocId(null)} />}
      {showStatsModal && <StatsModal documents={documents} onClose={() => setShowStatsModal(false)} />}

      {showCamera && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center">
          <div className="absolute top-6 right-6 z-50"><button onClick={stopCamera} className="bg-zinc-800/80 p-3 rounded-full text-white"><X className="w-6 h-6" /></button></div>
          <div className="w-full h-full relative flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="max-w-full max-h-full object-cover opacity-90" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-48 border-2 border-orange-500/80 rounded-2xl relative shadow-[0_0_100px_rgba(249,115,22,0.3)]">
                 <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-orange-500 -mt-0.5 -ml-0.5 rounded-tl-lg"></div>
                 <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-orange-500 -mt-0.5 -mr-0.5 rounded-tr-lg"></div>
                 <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-orange-500 -mb-0.5 -ml-0.5 rounded-bl-lg"></div>
                 <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-orange-500 -mb-0.5 -mr-0.5 rounded-br-lg"></div>
                 <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse"></div>
              </div>
            </div>
            {isCameraLoading && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50"><Loader2 className="w-16 h-16 text-orange-500 animate-spin mb-6" /><p className="text-white font-bold text-2xl">IA Analisando...</p></div>}
          </div>
          <div className="absolute bottom-12 w-full flex flex-col items-center gap-6 z-50 px-6">
            {cameraError && <div className="bg-red-500/90 text-white px-6 py-3 rounded-xl text-sm font-bold animate-bounce">{cameraError}</div>}
            <button onClick={captureAndAnalyze} disabled={isCameraLoading} className="w-20 h-20 rounded-full bg-white border-4 border-zinc-200 flex items-center justify-center shadow-2xl active:scale-95 group"><div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center"><Camera className="w-8 h-8 text-white" /></div></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
