import React from 'react';
import { DocumentItem, DocStatus } from '../types';
import { CheckCircle2, AlertCircle, TrendingUp, Package, FileText, Scan, Truck, Calendar } from 'lucide-react';

interface InfographicProps {
  documents: DocumentItem[];
  onFilterStatus: (status: DocStatus | null) => void;
  activeFilter: DocStatus | null;
}

export const Infographic: React.FC<InfographicProps> = ({ documents, onFilterStatus, activeFilter }) => {
  const total = documents.length;
  
  // --- Cálculos Gerais ---
  const counts = documents.reduce((acc, doc) => {
    acc[doc.status] = (acc[doc.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const errors = documents.filter(d => d.hasErrors).length;
  const completedCount = (counts[DocStatus.SHIPPING] || 0) + (counts[DocStatus.COMPLETED] || 0);
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // --- Cálculos Mensais (Últimos 6 meses) ---
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    d.setDate(1); // Normalizar para o primeiro dia
    return d;
  }).reverse();

  const monthlyData = last6Months.map(date => {
    const monthIdx = date.getMonth();
    const year = date.getFullYear();
    const label = date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
    
    // Filtrar documentos criados neste mês/ano
    const docsInMonth = documents.filter(d => {
      const dDate = new Date(d.createdAt);
      return dDate.getMonth() === monthIdx && dDate.getFullYear() === year;
    });

    const totalInMonth = docsInMonth.length;
    const completedInMonth = docsInMonth.filter(d => 
        d.status === DocStatus.SHIPPING || d.status === DocStatus.COMPLETED
    ).length;

    return { label, total: totalInMonth, completed: completedInMonth };
  });

  const maxMonthlyVolume = Math.max(...monthlyData.map(d => d.total), 5); 

  // --- Configuração SVG Donut ---
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (completionRate / 100) * circumference;

  const getPercent = (status: DocStatus) => {
    if (total === 0) return 0;
    return Math.round(((counts[status] || 0) / total) * 100);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="p-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="text-orange-500" />
            Performance Operacional
          </h2>
          <p className="text-gray-400 text-sm mt-1">Clique nos gráficos para filtrar a lista abaixo</p>
        </div>
        <div className="bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20 hidden sm:block">
          <span className="text-xs text-gray-300 uppercase tracking-wider block">Total Acumulado</span>
          <span className="text-2xl font-bold text-white">{total}</span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Seção 1: Gauge de Eficiência */}
        <div 
          onClick={() => onFilterStatus(activeFilter === DocStatus.COMPLETED ? null : DocStatus.COMPLETED)}
          className={`flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 pb-6 md:pb-0 cursor-pointer transition-opacity ${activeFilter && activeFilter !== DocStatus.COMPLETED ? 'opacity-40' : 'opacity-100'}`}
        >
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Taxa de Conclusão Global</h3>
          <div className="relative w-40 h-40 group">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
              <circle cx="80" cy="80" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} className="text-orange-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700">
              <span className="text-3xl font-bold text-gray-900">{completionRate}%</span>
              <span className="text-xs text-gray-500 group-hover:text-orange-600 font-medium transition-colors">Filtrar</span>
            </div>
          </div>
        </div>

        {/* Seção 2: Funil de Pipeline */}
        <div className="md:col-span-2 flex flex-col justify-center space-y-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-2">Funil de Processamento (Clique para filtrar)</h3>
          
          {[
            { id: DocStatus.CONFERENCE, label: '1ª Conferência', count: counts[DocStatus.CONFERENCE], color: 'bg-blue-500', icon: <FileText className="w-3 h-3"/>, percent: getPercent(DocStatus.CONFERENCE) },
            { id: DocStatus.SCANNER, label: 'Digitalização', count: counts[DocStatus.SCANNER], color: 'bg-purple-500', icon: <Scan className="w-3 h-3"/>, percent: getPercent(DocStatus.SCANNER) },
            { id: DocStatus.ACCEPTANCE, label: 'Aguardando Aceite', count: counts[DocStatus.ACCEPTANCE], color: 'bg-yellow-400', icon: <CheckCircle2 className="w-3 h-3"/>, percent: getPercent(DocStatus.ACCEPTANCE) },
            { id: DocStatus.SHIPPING, label: 'Envio / Finalizado', count: completedCount, color: 'bg-green-500', icon: <Truck className="w-3 h-3"/>, percent: completionRate }
          ].map((step, idx) => (
            <div 
              key={idx} 
              className={`relative cursor-pointer transition-all duration-200 ${activeFilter === step.id ? 'ring-2 ring-orange-400 rounded-lg p-1 bg-gray-50' : ''} ${activeFilter && activeFilter !== step.id ? 'opacity-40' : 'opacity-100'}`}
              onClick={() => onFilterStatus(activeFilter === step.id ? null : step.id)}
            >
              <div className="flex justify-between text-xs mb-1 font-medium">
                <span className="flex items-center gap-1 text-gray-700">{step.icon} {step.label}</span>
                <span className="text-gray-500">{step.count || 0} docs</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className={`${step.color} h-2 rounded-full transition-all duration-500`} 
                  style={{ width: `${step.percent}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Seção 3: Histórico Mensal */}
      <div className="border-t border-gray-100 p-6 bg-gray-50/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Evolução Mensal (Últimos 6 Meses)
          </h3>
          <div className="flex gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-300 rounded-sm"></div> Recebidos
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-sm"></div> Finalizados
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between h-40 gap-2 sm:gap-4 px-2">
          {monthlyData.map((data, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-2 group cursor-default">
              <div className="w-full h-full flex items-end justify-center relative">
                 <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-[10px] rounded py-1 px-2 whitespace-nowrap z-10 pointer-events-none shadow-lg transform translate-y-1 group-hover:translate-y-0">
                   <strong>{data.label}</strong><br/>
                   Total: {data.total}<br/>
                   Finalizados: {data.completed}
                 </div>
                 
                 <div 
                   className="w-full max-w-[30px] sm:max-w-[40px] bg-gray-200 rounded-t-sm relative overflow-hidden transition-all duration-700 ease-out hover:bg-gray-300"
                   style={{ height: `${(data.total / maxMonthlyVolume) * 100}%` }}
                 >
                    <div 
                      className="absolute bottom-0 left-0 w-full bg-orange-500 rounded-t-sm transition-all duration-1000 ease-out opacity-90"
                      style={{ height: `${data.total > 0 ? (data.completed / data.total) * 100 : 0}%` }}
                    ></div>
                 </div>
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-gray-500">{data.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white px-6 py-4 border-t flex items-center gap-3">
        <div className={`p-1.5 rounded-full ${errors > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>
          {errors > 0 ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
        </div>
        <p className={`text-xs font-bold ${errors > 0 ? 'text-red-700' : 'text-green-700'}`}>
          {errors > 0 ? `${errors} Documentos com pendências ou erros` : 'Nenhuma pendência reportada no sistema'}
        </p>
      </div>
    </div>
  );
};