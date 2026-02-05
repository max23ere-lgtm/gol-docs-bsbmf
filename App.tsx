
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
  Clock, 
  Plus, 
  CalendarDays, 
  CheckSquare, 
  Globe, 
  Plane
} from 'lucide-react';
import { DocumentItem, DocStatus, DocLog, STATUS_LABELS } from './types';
import { StatusBadge } from './components/StatusBadge';
import { Infographic } from './components/Infographic';
import { LogViewer } from './components/LogViewer';
import { StatsModal } from './components/StatsModal';
import { dbService } from './services/dbService';
import { extractDataFromImage } from './services/geminiService';

const SHARED_ACCESS_KEY = 'JGOL@BSBMFCDT$';

type DateFilterType = 'CREATED' | 'ORIGINAL';

function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('gol_current_user'));
  const [loginNameInput, setLoginNameInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isFirstLoadDone = useRef(false);
  
  const [scanInput, setScanInput] = useState('');
  // Novo estado para controle de Base Internacional
  const [isInternationalInput, setIsInternationalInput] = useState(false);
  
  const [ingestionDate, setIngestionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingLogsDocId, setViewingLogsDocId] = useState<string | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('gol_theme') === 'dark');

  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Filtros de Data
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterType>('CREATED');
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
      console.error("Falha ao carregar dados", err);
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

  const updateDocuments = (newDocs: DocumentItem[]) => {
    setDocuments(newDocs);
    localStorage.setItem('gol_docs_cache', JSON.stringify(newDocs));
  };

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
    const selectedOrgDate = ingestionDate ? new Date(ingestionDate).toISOString() : now;

    const newDoc: DocumentItem = {
      id: cleanCode,
      type: docType,
      status: DocStatus.CONFERENCE,
      hasErrors: false,
      errorCount: 0,
      createdBy: currentUser || 'Desconhecido',
      createdAt: now,
      originalDate: selectedOrgDate,
      // Salva o status internacional selecionado
      isInternational: isInternationalInput,
      logs: [{
        timestamp: now,
        action: `Cadastrado na base${isInternationalInput ? ' (Internacional)' : ''} (Data Original: ${new Date(selectedOrgDate).toLocaleDateString()})`,
        user: currentUser || 'Sistema'
      }]
    };

    const newDocs = [newDoc, ...documents];
    updateDocuments(newDocs);
    setScanInput(''); 
    return true;
  };

  useEffect(() => {
    const rawInput = scanInput.trim();
    if (!rawInput) return;
    const code = cleanScanCode(rawInput);
    if (code.length >= 9) {
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
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
      }
    } catch (err) {
      setCameraError('Erro ao acessar a câmera.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
    setIsCameraLoading(false);
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
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        const code = await extractDataFromImage(base64);
        if (code) {
          if (navigator.vibrate) navigator.vibrate(200);
          const registered = registerDocument(code);
          if (registered) {
            stopCamera();
          } else {
             setCameraError(`WO ${code} já registrada.`);
             setTimeout(() => setIsCameraLoading(false), 1500);
          }
        } else {
          setCameraError('IA não identificou WO. Tente novamente.');
          setIsCameraLoading(false);
        }
      }
    } catch (err) {
      setCameraError('Erro na análise da IA.');
      setIsCameraLoading(false);
    }
  };

  const updateStatus = (id: string, newStatus: DocStatus) => {
    const updated = documents.map(doc => {
      if (doc.id !== id) return doc;
      const newLog: DocLog = {
        timestamp: new Date().toISOString(),
        action: `Status: ${STATUS_LABELS[newStatus]}`,
        user: currentUser || 'Operador'
      };
      return { ...doc, status: newStatus, logs: [newLog, ...doc.logs] };
    });
    updateDocuments(updated);
  };

  const updateDocField = (id: string, field: keyof DocumentItem, value: any) => {
    const updated = documents.map(doc => {
      if (doc.id !== id) return doc;
      return { ...doc, [field]: value };
    });
    updateDocuments(updated);
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
    let updated;
    if (doc.hasErrors) {
      updated = documents.map(d => {
        if (d.id !== doc.id) return d;
        const newErrorCount = Math.max(0, d.errorCount - 1);
        const newLog: DocLog = {
          timestamp: new Date().toISOString(),
          action: 'Apontamento de erro cancelado',
          user: currentUser || 'Supervisor'
        };
        return { 
          ...d, 
          status: DocStatus.CONFERENCE, 
          hasErrors: false, 
          errorCount: newErrorCount,
          logs: [newLog, ...d.logs] 
        };
      });
    } else {
      const prevStatus = getPrevStatus(doc.status);
      if (!prevStatus) return;
      updated = documents.map(d => {
        if (d.id !== doc.id) return d;
        const newLog: DocLog = {
          timestamp: new Date().toISOString(),
          action: `Retorno de Etapa: ${STATUS_LABELS[prevStatus]}`,
          user: currentUser || 'Supervisor'
        };
        return { ...d, status: prevStatus, logs: [newLog, ...d.logs] };
      });
    }
    
    if (updated) updateDocuments(updated);
  };

  const toggleError = (id: string) => {
    const updated = documents.map(doc => {
      if (doc.id !== id) return doc;
      const hasErrors = !doc.hasErrors;
      const newStatus = hasErrors ? DocStatus.RETURN : doc.status;
      const now = new Date().toISOString();
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
    });
    updateDocuments(updated);
  };

  // --- Lógica de Seleção Múltipla ---

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (visibleDocs: DocumentItem[]) => {
    if (selectedIds.length === visibleDocs.length && visibleDocs.length > 0) {
      setSelectedIds([]); // Deselect all
    } else {
      setSelectedIds(visibleDocs.map(d => d.id)); // Select all visible
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const password = window.prompt(`⚠️ EXCLUSÃO EM MASSA\n\nVocê está prestes a apagar ${selectedIds.length} documentos.\nDigite a SENHA DA EQUIPE para confirmar:`);
    if (password === SHARED_ACCESS_KEY) {
      setIsDeleting(true);
      // Remove do estado (UI)
      const updated = documents.filter(d => !selectedIds.includes(d.id));
      setDocuments(updated); 
      // Chama o serviço para remover do LocalStorage e Firebase
      await dbService.deleteDocuments(selectedIds);
      setSelectedIds([]);
      setIsDeleting(false);
    }
  };

  const deleteDocument = async (id: string) => {
    const password = window.prompt("⚠️ AÇÃO DE SEGURANÇA\n\nDigite a SENHA DA EQUIPE para confirmar a exclusão:");
    if (password === SHARED_ACCESS_KEY) {
      setIsDeleting(true); 
      // Remove do estado (UI)
      const updated = documents.filter(d => d.id !== id);
      setDocuments(updated);
      // Chama o serviço para remover do LocalStorage e Firebase
      await dbService.deleteDocument(id);
      setIsDeleting(false);
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
      const targetDate = dateFilterMode === 'ORIGINAL' 
        ? (doc.originalDate || doc.createdAt) 
        : doc.createdAt;
        
      const docDate = new Date(targetDate);
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
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Carregando Base GOL...</h2>
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
              <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-95">ACESSAR SISTEMA</button>
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
                 {isSyncing ? <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" /> : syncError ? <div className="flex items-center gap-1 text-red-500"><WifiOff className="w-3 h-3" /><span className="text-[8px] font-black uppercase tracking-widest">Sinc. Pendente</span></div> : <CloudCheck className="w-3 h-3 text-green-500" />}
                 <span className={`text-[10px] font-bold uppercase tracking-wide ${syncError ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500'}`}>{isSyncing ? 'Salvando...' : syncError ? 'Erro Nuvem' : 'Sincronizado'}</span>
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

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8 relative pb-24">
        <Infographic documents={documents} activeFilter={statusFilter} onFilterStatus={setStatusFilter} />

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-zinc-800 flex flex-col lg:flex-row gap-6 items-start lg:items-center">
          
          <div className="w-full lg:w-1/4">
            <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">Data Original (ORG)</label>
            <div className="relative group">
              <Calendar className="absolute left-4 top-3.5 h-4 w-4 text-orange-500 pointer-events-none group-focus-within:scale-110 transition-transform" />
              <input 
                type="date" 
                value={ingestionDate} 
                onChange={(e) => setIngestionDate(e.target.value)} 
                className="w-full pl-11 pr-4 py-3 bg-orange-50 dark:bg-orange-500/5 border-2 border-orange-100 dark:border-orange-500/20 rounded-2xl text-sm font-bold text-orange-900 dark:text-orange-400 focus:outline-none focus:border-orange-500 transition-all cursor-pointer"
              />
            </div>
          </div>

          <div className="w-full lg:flex-1">
            <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">Scanner ou WO Manual</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group">
                <ScanLine className="absolute left-4 top-4 h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                <input 
                  type="text" 
                  autoFocus 
                  value={scanInput} 
                  onChange={(e) => setScanInput(e.target.value)} 
                  className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-100 dark:border-zinc-700 rounded-2xl bg-gray-50 dark:bg-zinc-800 placeholder-gray-400 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-orange-500 sm:text-base transition-all font-mono font-medium shadow-inner" 
                  placeholder="Bipar Código ou Digitar..." 
                />
              </div>
              
              <div className="flex gap-2">
                {/* Botão para ativar modo Internacional */}
                <button 
                  onClick={() => setIsInternationalInput(!isInternationalInput)} 
                  className={`px-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 shadow-sm ${isInternationalInput ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400 hover:border-blue-400'}`}
                  title="Documento de Base Internacional / Service Provider"
                >
                  <Globe className="w-5 h-5" />
                  <span className="hidden sm:inline text-xs font-bold uppercase">{isInternationalInput ? 'INTL' : 'NAC'}</span>
                </button>

                <button onClick={startCamera} className="px-5 bg-zinc-900 dark:bg-zinc-700 text-white rounded-2xl hover:bg-orange-600 transition-colors flex items-center justify-center shadow-lg active:scale-95"><Camera className="w-6 h-6" /></button>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/3 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">Pesquisa Rápida</label>
              <div className="relative">
                <Filter className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-11 pr-4 py-3 border-2 border-gray-100 dark:border-zinc-700 rounded-2xl bg-white dark:bg-zinc-800 focus:border-orange-500 outline-none text-sm font-medium dark:text-white" placeholder="WO, Autor, Status..." />
              </div>
            </div>
          </div>
        </div>

        {syncError && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-pulse">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-tight">O banco de dados central está offline ou rejeitando conexão. Seus dados estão seguros neste navegador.</p>
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 shadow-xl rounded-3xl overflow-hidden border border-gray-100 dark:border-zinc-800">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-500/20 rounded-lg"><Database className="w-5 h-5 text-orange-600 dark:text-orange-500" /></div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Relatório de WOs BSB</h2>
            </div>
            
            {/* Controles de Filtro Avançado */}
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-xl p-1 border dark:border-zinc-700">
                 <button 
                   onClick={() => setDateFilterMode('CREATED')}
                   className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${dateFilterMode === 'CREATED' ? 'bg-white dark:bg-zinc-700 text-orange-600 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                   Dt. Inserção
                 </button>
                 <button 
                   onClick={() => setDateFilterMode('ORIGINAL')}
                   className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${dateFilterMode === 'ORIGINAL' ? 'bg-white dark:bg-zinc-700 text-orange-600 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                   Dt. Original
                 </button>
              </div>

              <div className="flex gap-2 items-center bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border dark:border-zinc-700">
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="bg-transparent border-none text-[10px] font-bold p-0 w-24 outline-none text-gray-600 dark:text-gray-300" />
                <span className="text-gray-300">|</span>
                <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="bg-transparent border-none text-[10px] font-bold p-0 w-24 outline-none text-gray-600 dark:text-gray-300" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-zinc-800">
              <thead className="hidden md:table-header-group bg-gray-50/50 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-5 text-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      checked={filteredDocs.length > 0 && selectedIds.length === filteredDocs.length}
                      onChange={() => toggleSelectAll(filteredDocs)}
                    />
                  </th>
                  <th className="px-4 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">WO / Tipo</th>
                  <th className="px-4 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Fluxo</th>
                  <th className="px-4 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Datas de Controle</th>
                  <th className="px-4 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Alertas</th>
                  <th className="px-4 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Controles</th>
                  <th className="px-4 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Opções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                {filteredDocs.length === 0 ? (
                  <tr><td colSpan={7} className="px-8 py-16 text-center text-gray-400 dark:text-zinc-600 font-medium tracking-widest uppercase text-xs">Aguardando novos registros...</td></tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className={`hover:bg-orange-50/20 dark:hover:bg-zinc-800/30 transition-colors group flex flex-col md:table-row ${selectedIds.includes(doc.id) ? 'bg-orange-50/40 dark:bg-orange-900/10' : ''}`}>
                      <td className="px-4 py-5 whitespace-nowrap text-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                          checked={selectedIds.includes(doc.id)}
                          onChange={() => toggleSelectOne(doc.id)}
                        />
                      </td>
                      <td className="px-4 py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center font-black text-[10px] shadow-sm relative overflow-hidden ${doc.type === 'RTA' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'}`}>
                            {doc.type}
                            {/* Indicador de Internacional (Fundo sutil) */}
                            {doc.isInternational && <div className="absolute inset-0 bg-blue-400/50 flex items-center justify-center"><Globe className="w-8 h-8 opacity-20" /></div>}
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center gap-2">
                               <div className="text-sm font-black text-gray-900 dark:text-white font-mono tracking-tight">{doc.id}</div>
                               {/* Ícone de Internacional */}
                               {doc.isInternational && <span title="Base Internacional / Service Provider"><Globe className="w-3.5 h-3.5 text-blue-500" /></span>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <User className="w-2.5 h-2.5 text-gray-400" />
                              <span className="text-[10px] font-bold text-gray-400 uppercase">{doc.createdBy.split(' ')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5 whitespace-nowrap">
                         <div className="flex flex-col gap-1.5 items-start">
                           <StatusBadge status={doc.status} />
                           {doc.hasErrors && (
                             <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30">
                               <AlertCircle className="w-3 h-3 text-red-500" />
                               <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">Erro de Auditoria</span>
                             </div>
                           )}
                         </div>
                      </td>
                      <td className="px-4 py-5 whitespace-nowrap">
                         <div className="flex flex-col gap-2">
                           
                           {/* Data Original */}
                           <div className="flex items-center gap-2 group/date">
                             <div className="p-1.5 bg-orange-50 dark:bg-orange-500/10 rounded-lg border border-orange-100 dark:border-orange-500/20">
                               <Calendar className="w-3 h-3 text-orange-600 dark:text-orange-500" />
                             </div>
                             <div>
                               <p className="text-[8px] font-black text-orange-400 dark:text-orange-600 uppercase leading-none mb-1 tracking-tight">Data Original</p>
                               <input 
                                 type="date" 
                                 value={(doc.originalDate || doc.createdAt).split('T')[0]} 
                                 onChange={(e) => updateDocField(doc.id, 'originalDate', new Date(e.target.value).toISOString())} 
                                 className="bg-transparent border-none p-0 text-xs font-black text-gray-800 dark:text-gray-200 outline-none focus:ring-0 cursor-pointer" 
                               />
                             </div>
                           </div>

                           {/* Data Inserção */}
                           <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100 dark:border-blue-500/20">
                               <Clock className="w-3 h-3 text-blue-600 dark:text-blue-500" />
                             </div>
                             <div>
                               <p className="text-[8px] font-black text-blue-400 dark:text-blue-600 uppercase leading-none mb-1 tracking-tight">Inserção (Sys)</p>
                               <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                 {new Date(doc.createdAt).toLocaleDateString()} <span className="text-[9px] opacity-70">{new Date(doc.createdAt).toLocaleTimeString().slice(0,5)}</span>
                               </span>
                             </div>
                           </div>

                         </div>
                      </td>
                      <td className="px-4 py-5 whitespace-nowrap">
                         <div className="flex flex-col gap-1.5">
                            {doc.errorCount > 0 ? (
                              <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-black uppercase bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/30">
                                <AlertCircle className="w-3.5 h-3.5" /> {doc.errorCount} Apontamentos
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-green-500 text-[10px] font-black uppercase tracking-widest">
                                <CheckCircle2 className="w-3.5 h-3.5" /> 100% OK
                              </div>
                            )}
                         </div>
                      </td>
                      <td className="px-4 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2 flex-wrap">
                           {canRevert(doc) && <button onClick={() => revertStatus(doc)} className="p-2 bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:text-orange-500 rounded-xl border border-gray-200 dark:border-zinc-700 transition-all active:scale-90"><ArrowLeft className="w-4 h-4" /></button>}
                           {doc.status === DocStatus.CONFERENCE && (
                             <>
                              <button onClick={() => toggleError(doc.id)} className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${doc.hasErrors ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700 hover:text-red-500'}`}>{doc.hasErrors ? 'Erro Ativo' : 'Reportar Erro'}</button>
                              {!doc.hasErrors && <button onClick={() => updateStatus(doc.id, DocStatus.SCANNER)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:bg-indigo-700 active:scale-95">Liberar <ArrowRight className="w-3.5 h-3.5" /></button>}
                             </>
                           )}
                           {doc.status === DocStatus.RETURN && <button onClick={() => { toggleError(doc.id); updateStatus(doc.id, DocStatus.CONFERENCE); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:bg-green-700 active:scale-95"><CheckCircle2 className="w-3.5 h-3.5" /> Corrigido</button>}
                           {doc.status === DocStatus.SCANNER && <button onClick={() => updateStatus(doc.id, DocStatus.ACCEPTANCE)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:bg-purple-700 active:scale-95">Digitalizar <ArrowRight className="w-3.5 h-3.5" /></button>}
                           {doc.status === DocStatus.ACCEPTANCE && <button onClick={() => updateStatus(doc.id, DocStatus.SHIPPING)} className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:bg-yellow-600 active:scale-95">Dar Aceite <ArrowRight className="w-3.5 h-3.5" /></button>}
                           {doc.status === DocStatus.SHIPPING && <button onClick={() => updateStatus(doc.id, DocStatus.COMPLETED)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:bg-orange-700 active:scale-95">Finalizar <CheckCircle2 className="w-3.5 h-3.5" /></button>}
                        </div>
                      </td>
                      <td className="px-4 py-5 whitespace-nowrap text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setViewingLogsDocId(doc.id)} className="p-2.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" title="Ver Histórico"><History className="w-4.5 h-4.5" /></button>
                          <button onClick={() => deleteDocument(doc.id)} className="p-2.5 text-gray-300 dark:text-zinc-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all" title="Excluir Registro"><Trash2 className="w-4.5 h-4.5" /></button>
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

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
           <div className="flex items-center gap-3">
             <div className="bg-orange-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
               {selectedIds.length}
             </div>
             <span className="font-medium text-sm">Selecionados</span>
           </div>
           <div className="h-6 w-px bg-gray-700"></div>
           <button 
             onClick={handleBulkDelete} 
             className="flex items-center gap-2 text-red-400 hover:text-red-300 font-bold text-sm transition-colors"
           >
             <Trash2 className="w-4 h-4" />
             Excluir em Massa
           </button>
           <button 
             onClick={() => setSelectedIds([])} 
             className="bg-gray-800 hover:bg-gray-700 p-2 rounded-full transition-colors ml-2"
           >
             <X className="w-4 h-4" />
           </button>
        </div>
      )}

      <footer className="border-t border-gray-200 dark:border-zinc-800 py-10 mt-10 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500 dark:text-zinc-500 gap-6">
          <div className="font-bold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            © {new Date().getFullYear()} GOL Linhas Aéreas - Manutenção Centralizada BSB
          </div>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 px-4 py-2 rounded-2xl border dark:border-zinc-700 shadow-inner">
            <User className="w-3 h-3 text-orange-500" />
            Criado por <strong className="text-gray-900 dark:text-white">José Augusto Torres</strong> • <a href="mailto:jatsilva@voegol.com.br" className="hover:text-orange-500 underline font-black">jatsilva@voegol.com.br</a>
          </div>
        </div>
      </footer>

      {viewingLogsDocId && <LogViewer document={documents.find(d => d.id === viewingLogsDocId)!} onClose={() => setViewingLogsDocId(null)} />}
      {showStatsModal && <StatsModal documents={documents} onClose={() => setShowStatsModal(false)} />}

      {showCamera && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center">
          <div className="absolute top-6 right-6 z-50"><button onClick={stopCamera} className="bg-zinc-800/80 p-3 rounded-full text-white hover:bg-red-500 transition-colors"><X className="w-6 h-6" /></button></div>
          <div className="w-full h-full relative flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="max-w-full max-h-full object-cover opacity-90" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-48 border-2 border-orange-500/80 rounded-2xl relative shadow-[0_0_100px_rgba(249,115,22,0.3)]">
                 <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse"></div>
              </div>
            </div>
            {isCameraLoading && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50"><Loader2 className="w-16 h-16 text-orange-500 animate-spin mb-6" /><p className="text-white font-black text-2xl tracking-tighter">Gemini analisando WO...</p></div>}
          </div>
          <div className="absolute bottom-12 w-full flex flex-col items-center gap-6 z-50 px-6">
            {cameraError && <div className="bg-red-500 text-white px-6 py-4 rounded-2xl text-sm font-black shadow-xl animate-bounce flex items-center gap-3"><AlertCircle className="w-5 h-5" /> {cameraError}</div>}
            <button onClick={captureAndAnalyze} disabled={isCameraLoading} className="w-20 h-20 rounded-full bg-white border-4 border-zinc-200 flex items-center justify-center shadow-2xl active:scale-95 group disabled:opacity-50 transition-all"><div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center group-hover:bg-orange-500 transition-colors"><Camera className="w-8 h-8 text-white" /></div></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
