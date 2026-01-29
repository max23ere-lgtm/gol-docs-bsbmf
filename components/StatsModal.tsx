import React from 'react';
import { X, Calendar, AlertCircle, CheckCircle2, BarChart3, TrendingUp, CalendarDays, CalendarRange } from 'lucide-react';
import { DocumentItem } from '../types';

interface StatsModalProps {
  documents: DocumentItem[];
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ documents, onClose }) => {
  const now = new Date();
  
  // Helpers de Data
  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getDate() === now.getDate() && 
           d.getMonth() === now.getMonth() && 
           d.getFullYear() === now.getFullYear();
  };

  const isThisMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getMonth() === now.getMonth() && 
           d.getFullYear() === now.getFullYear();
  };

  const isThisYear = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear();
  };

  // Cálculos
  const stats = {
    today: {
      total: documents.filter(d => isToday(d.createdAt)).length,
      errors: documents.filter(d => isToday(d.createdAt) && d.hasErrors).length,
    },
    month: {
      total: documents.filter(d => isThisMonth(d.createdAt)).length,
      errors: documents.filter(d => isThisMonth(d.createdAt) && d.hasErrors).length,
    },
    year: {
      total: documents.filter(d => isThisYear(d.createdAt)).length,
      errors: documents.filter(d => isThisYear(d.createdAt) && d.hasErrors).length,
    }
  };

  const StatCard = ({ title, icon: Icon, data, subLabel }: any) => (
    <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-gray-100 dark:border-zinc-700 shadow-lg relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="w-24 h-24 text-gray-900 dark:text-white" />
      </div>
      
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-orange-50 dark:bg-orange-500/10 rounded-lg">
          <Icon className="w-6 h-6 text-orange-600 dark:text-orange-500" />
        </div>
        <h4 className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">{title}</h4>
      </div>

      <div className="space-y-4 relative z-10">
        <div>
          <span className="text-4xl font-black text-gray-800 dark:text-white block">{data.total}</span>
          <span className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase">{subLabel}</span>
        </div>
        
        <div className="flex items-center gap-4 pt-4 border-t border-gray-100 dark:border-zinc-700">
           <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-bold">{data.total - data.errors} OK</span>
           </div>
           <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-bold">{data.errors} Erros</span>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-zinc-800">
        
        {/* Header */}
        <div className="p-8 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-md">
          <div>
            <h2 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-orange-500" />
              Relatório Estatístico
            </h2>
            <p className="text-gray-500 dark:text-zinc-400 mt-1 font-medium">Visão analítica de produtividade e qualidade</p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 dark:text-zinc-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 bg-gray-50/30 dark:bg-zinc-950">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard 
              title="Hoje" 
              icon={Calendar} 
              data={stats.today} 
              subLabel="Registros do dia"
            />
            <StatCard 
              title="Este Mês" 
              icon={CalendarDays} 
              data={stats.month} 
              subLabel={`Acumulado de ${now.toLocaleString('pt-BR', { month: 'long' })}`}
            />
            <StatCard 
              title="Este Ano" 
              icon={CalendarRange} 
              data={stats.year} 
              subLabel={`Total em ${now.getFullYear()}`}
            />
          </div>

          {/* Breakdown Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-3xl p-8 border border-gray-100 dark:border-zinc-700 shadow-sm">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                   <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Performance Geral</h3>
             </div>

             <div className="relative pt-6">
                <div className="flex h-4 rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-700">
                  <div className="bg-green-500 h-full" style={{ width: `${(1 - (stats.year.errors / (stats.year.total || 1))) * 100}%` }}></div>
                  <div className="bg-red-500 h-full" style={{ width: `${(stats.year.errors / (stats.year.total || 1)) * 100}%` }}></div>
                </div>
                <div className="flex justify-between mt-3 text-sm font-bold">
                   <span className="text-green-600 dark:text-green-400">{(100 - (stats.year.errors / (stats.year.total || 1)) * 100).toFixed(1)}% Eficiência (Sem erros)</span>
                   <span className="text-red-500 dark:text-red-400">{((stats.year.errors / (stats.year.total || 1)) * 100).toFixed(1)}% Taxa de Retorno</span>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};