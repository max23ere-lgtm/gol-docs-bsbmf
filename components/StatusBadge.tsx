import React from 'react';
import { DocStatus, STATUS_LABELS, STATUS_COLORS } from '../types';

interface StatusBadgeProps {
  status: DocStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
};