
export enum DocStatus {
  CONFERENCE = 'CONFERENCE',   // Primeira Conferência
  RETURN = 'RETURN',           // Retorno para Correção
  SCANNER = 'SCANNER',         // Digitalização
  ACCEPTANCE = 'ACCEPTANCE',   // Aceite
  SHIPPING = 'SHIPPING',       // Envio Físico (CI)
  COMPLETED = 'COMPLETED'      // Finalizado
}

export interface DocLog {
  timestamp: string;
  action: string;
  user?: string;
}

export interface DocumentItem {
  id: string; // WO number / Barcode
  type: string; // RTA, FAR
  aircraft?: string;
  status: DocStatus;
  hasErrors: boolean;
  errorCount: number; // Total number of errors flagged over time
  createdBy: string; // Name of the user who inserted it
  logs: DocLog[];
  imageUrl?: string; // For the scanner phase
  createdAt: string; // Data de inserção no sistema
  originalDate: string; // Data original do documento físico
  correctionStartedAt?: string; // Data que iniciou a primeira correção
  isInternational?: boolean; // Identifica se é Service Provider/Base Internacional
}

export const STATUS_LABELS: Record<DocStatus, string> = {
  [DocStatus.CONFERENCE]: '1ª Conferência',
  [DocStatus.RETURN]: 'Retorno (Correção)',
  [DocStatus.SCANNER]: 'Scanner/Digitalização',
  [DocStatus.ACCEPTANCE]: 'Aguardando Aceite',
  [DocStatus.SHIPPING]: 'Envio Físico (CI)',
  [DocStatus.COMPLETED]: 'Concluído',
};

export const STATUS_COLORS: Record<DocStatus, string> = {
  [DocStatus.CONFERENCE]: 'bg-blue-100 text-blue-800 border-blue-200',
  [DocStatus.RETURN]: 'bg-red-100 text-red-800 border-red-200',
  [DocStatus.SCANNER]: 'bg-purple-100 text-purple-800 border-purple-200',
  [DocStatus.ACCEPTANCE]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [DocStatus.SHIPPING]: 'bg-orange-100 text-orange-800 border-orange-200',
  [DocStatus.COMPLETED]: 'bg-green-100 text-green-800 border-green-200',
};
