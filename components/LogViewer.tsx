import React from 'react';
import { X, History, User, Clock, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { DocumentItem } from '../types';

interface LogViewerProps {
  document: DocumentItem;
  onClose: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ document, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <History className="w-5 h-5 text-orange-500" />
              Histórico de Auditoria
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Documento: <span className="text-gray-900 font-bold">{document.id}</span>
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-red-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white scrollbar-thin scrollbar-thumb-gray-200">
          <div className="relative border-l-2 border-gray-100 ml-3 space-y-8 pb-4">
            {document.logs.map((log, index) => {
              // Ícones baseados na ação (lógica simples de string matching)
              let Icon = FileText;
              let iconColor = "bg-gray-100 text-gray-500";
              
              if (log.action.includes('Erro')) {
                Icon = AlertCircle;
                iconColor = "bg-red-100 text-red-600 border-red-200";
              } else if (log.action.includes('Cadastrado')) {
                Icon = FileText;
                iconColor = "bg-blue-100 text-blue-600 border-blue-200";
              } else if (log.action.includes('Status') || log.action.includes('Finalizar') || log.action.includes('Liberar')) {
                Icon = CheckCircle2;
                iconColor = "bg-green-100 text-green-600 border-green-200";
              }

              return (
                <div key={index} className="relative pl-8 group">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[9px] top-0 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${iconColor} shadow-sm z-10`}>
                    <Icon className="w-3 h-3" />
                  </div>

                  {/* Content */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-gray-800 group-hover:text-orange-600 transition-colors">
                      {log.action}
                    </span>
                    
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                        <User className="w-3 h-3" />
                        <span className="font-medium">{log.user || 'Sistema'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(log.timestamp).toLocaleDateString('pt-BR')} às {new Date(log.timestamp).toLocaleTimeString('pt-BR').slice(0, 5)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center text-[10px] text-gray-400 font-medium uppercase tracking-wider">
          Fim do Registro • GOL DOCS BSB
        </div>
      </div>
    </div>
  );
};
