import React from 'react';
import { DocumentItem, DocStatus } from '../types';
import { CheckCircle2, AlertCircle, Activity, Package, FileText, Scan, Truck, Calendar, ArrowUpRight, BarChart3, TrendingUp } from 'lucide-react';

interface InfographicProps {
  documents: DocumentItem[];
  onFilterStatus: (status: DocStatus | null) => void;
  activeFilter: DocStatus | null;
}

export const Infographic: React.FC<InfographicProps> = ({ documents, onFilterStatus, activeFilter }) => {
  const total = documents.length;
  
  // --- Cálculos ---
  const counts = documents.reduce((acc, doc) => {
    acc[doc.status] = (acc[doc.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const errors = documents.filter(d => d.hasErrors).length;
  const completedCount = (counts[DocStatus.SHIPPING] || 0) + (counts[DocStatus.COMPLETED] || 0);
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // --- Gráfico Mensal ---
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    d.setDate(1); 
    return d;
  }).reverse();

  const monthlyData = last6Months.map(date => {
    const monthIdx = date.getMonth();
    const year = date.getFullYear();
    const label = date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
    
    const docsInMonth = documents.filter(d => {
      const dDate = new Date(d.createdAt);
      return dDate.getMonth() === monthIdx && dDate.getFullYear() === year;
    });

    const totalInMonth = docsInMonth.length;
    return { label, total: totalInMonth };
  });

  const maxMonthlyVolume = Math.max(...monthlyData.map(d => d.total), 5); 

  // --- SVG Donut Config ---
  // ViewBox: 0 0 128 128. Center: 64, 64. Radius: 50.
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (completionRate / 100) * circumference;

  const getPercent = (status: DocStatus) => {
    if (total === 0) return 0;
    return Math.round(((counts[status] || 0) / total) * 100);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
      
      {/* CARD 1: PERFORMANCE GERAL (GAUGE) */}
      <div 
        onClick={() => onFilterStatus(activeFilter === DocStatus.COMPLETED ? null : DocStatus.COMPLETED)}
        className={`col-span-1 bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl shadow-orange-500/5 border border-gray-100 dark:border-zinc-800 cursor-pointer relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 ${activeFilter === DocStatus.COMPLETED ? 'ring-2 ring-orange-500' : ''}`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none transition-all group-hover:bg-orange-500/20"></div>
        
        <div className="flex justify-between items-start mb-2">
          <div>
             <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Taxa de Conclusão</h3>
             <p className="text-[10px] text-gray-400 dark:text-zinc-600">Performance Geral</p>
          </div>
          <Activity className="w-4 h-4 text-orange-500" />
        </div>

        <div className="flex flex-col items-center justify-center py-2">
           <div className="relative w-40 h-40 flex items-center justify-center">
            {/* SVG com ViewBox fixo para garantir centralização perfeita */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
              {/* Background Circle */}
              <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100 dark:text-zinc-800" />
              {/* Progress Circle */}
              <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} className="text-orange-500 transition-all duration-1000 ease-out drop-shadow-lg" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-gray-800 dark:text-white tracking-tighter">{completionRate}%</span>
              <span className="text-[9px] uppercase font-bold text-gray-400 dark:text-zinc-500 mt-1">Finalizado</span>
            </div>
           </div>
        </div>
        <div className="text-center mt-2">
           <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full uppercase tracking-wide border border-green-100 dark:border-green-900/30">
             <CheckCircle2 className="w-3 h-3" />
             {completedCount} Processos OK
           </div>
        </div>
      </div>

      {/* CARD 2: FUNIL DE FLUXO */}
      <div className="col-span-1 lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl shadow-orange-500/5 border border-gray-100 dark:border-zinc-800 flex flex-col">
         <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 dark:bg-orange-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider">Pipeline de Manutenção</h3>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium">Fluxo em tempo real</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-gray-800 dark:text-white block leading-none">{total}</span>
              <span className="text-xs text-gray-400 dark:text-zinc-600 font-bold uppercase">Total Docs</span>
            </div>
         </div>

         <div className="flex-1 flex flex-col justify-center space-y-5">
            {[
              { id: DocStatus.CONFERENCE, label: '1ª Conferência', count: counts[DocStatus.CONFERENCE], color: 'bg-blue-500', icon: <FileText className="w-3 h-3"/>, percent: getPercent(DocStatus.CONFERENCE) },
              { id: DocStatus.SCANNER, label: 'Digitalização', count: counts[DocStatus.SCANNER], color: 'bg-purple-500', icon: <Scan className="w-3 h-3"/>, percent: getPercent(DocStatus.SCANNER) },
              { id: DocStatus.ACCEPTANCE, label: 'Aguard. Aceite', count: counts[DocStatus.ACCEPTANCE], color: 'bg-yellow-500', icon: <CheckCircle2 className="w-3 h-3"/>, percent: getPercent(DocStatus.ACCEPTANCE) },
              { id: DocStatus.SHIPPING, label: 'Envio / Finalizado', count: completedCount, color: 'bg-green-500', icon: <Truck className="w-3 h-3"/>, percent: completionRate },
            ].map((step, idx) => (
              <div 
                key={idx} 
                onClick={() => onFilterStatus(activeFilter === step.id ? null : step.id)}
                className={`group cursor-pointer transition-all ${activeFilter === step.id ? 'opacity-100 scale-[1.02]' : activeFilter ? 'opacity-40 grayscale' : 'opacity-100'}`}
              >
                <div className="flex justify-between items-center text-xs mb-2">
                   <div className="flex items-center gap-2 font-bold text-gray-600 dark:text-zinc-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors uppercase text-[10px] tracking-wide">
                     <span className={`p-1 rounded-md ${step.percent > 0 ? 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400' : 'bg-gray-50 dark:bg-zinc-800/50 text-gray-300 dark:text-zinc-600'}`}>{step.icon}</span>
                     {step.label}
                   </div>
                   <span className="font-mono font-bold text-gray-800 dark:text-white bg-gray-50 dark:bg-zinc-800 px-2 py-0.5 rounded border border-gray-100 dark:border-zinc-700">{step.count || 0}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden border border-gray-50 dark:border-zinc-700/50">
                   <div className={`${step.color} h-2 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.2)] transition-all duration-700 ease-out relative overflow-hidden`} style={{ width: `${Math.max(step.percent, 2)}%` }}>
                      <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse"></div>
                   </div>
                </div>
              </div>
            ))}
         </div>
      </div>

      {/* CARD 3: VOLUME E ALERTAS */}
      <div className="col-span-1 bg-gradient-to-br from-zinc-800 to-black text-white rounded-3xl p-6 shadow-xl shadow-black/20 border border-zinc-700/50 flex flex-col justify-between relative overflow-hidden">
         {/* Background Effect */}
         <div className="absolute -right-10 -top-10 w-48 h-48 bg-orange-600/20 rounded-full blur-[60px] pointer-events-none animate-pulse"></div>

         <div className="relative z-10">
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><BarChart3 className="w-4 h-4"/> Volumetria</h3>
           </div>
           
           <div className="space-y-4 mb-4">
              <div className="flex justify-between items-end border-b border-white/10 pb-2">
                 <span className="text-xs text-zinc-400">Total Processado</span>
                 <span className="text-2xl font-black">{total}</span>
              </div>
              <div 
                onClick={() => onFilterStatus(activeFilter === DocStatus.RETURN ? null : DocStatus.RETURN)}
                className={`flex justify-between items-end border-b border-white/10 pb-2 cursor-pointer transition-all ${activeFilter === DocStatus.RETURN ? 'bg-white/10 px-2 -mx-2 rounded' : 'hover:bg-white/5'}`}
              >
                 <span className={`text-xs ${activeFilter === DocStatus.RETURN ? 'text-white' : 'text-zinc-400'}`}>Pendente Correção</span>
                 <span className={`text-xl font-bold ${errors > 0 ? 'text-red-400' : 'text-green-400'}`}>{errors}</span>
              </div>
           </div>
         </div>

         <div className="mt-auto relative z-10">
            <div 
              onClick={() => onFilterStatus(activeFilter === DocStatus.RETURN ? null : DocStatus.RETURN)}
              className={`p-4 rounded-2xl border flex items-center gap-3 backdrop-blur-md transition-all cursor-pointer hover:scale-105 active:scale-95 ${activeFilter === DocStatus.RETURN ? 'ring-2 ring-orange-500 shadow-lg shadow-orange-500/20' : ''} ${errors > 0 ? 'bg-red-500/10 border-red-500/20 text-red-200 hover:bg-red-500/20' : 'bg-green-500/10 border-green-500/20 text-green-200 hover:bg-green-500/20'}`}
            >
               {errors > 0 ? <AlertCircle className="w-6 h-6 shrink-0"/> : <CheckCircle2 className="w-6 h-6 shrink-0"/>}
               <div>
                 <p className="text-sm font-bold leading-none mb-1">{errors > 0 ? 'Ação Requerida' : 'Operação Estável'}</p>
                 <p className="text-[10px] opacity-70 uppercase tracking-wide">{errors > 0 ? 'Verifique os erros' : 'Nenhuma pendência'}</p>
               </div>
            </div>
         </div>

         {/* Mini Bar Chart at bottom */}
         <div className="absolute bottom-0 right-0 left-0 h-24 flex items-end justify-between px-6 pb-0 opacity-10 pointer-events-none">
            {monthlyData.map((d, i) => (
              <div key={i} className="w-full mx-1 bg-white rounded-t-sm transition-all hover:opacity-50" style={{ height: `${d.total > 0 ? (d.total / maxMonthlyVolume) * 100 : 5}%` }}></div>
            ))}
         </div>
      </div>

    </div>
  );
};