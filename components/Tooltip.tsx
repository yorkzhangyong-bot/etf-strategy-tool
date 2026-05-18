'use client';

import { useState } from 'react';
import dictionary from '@/dictionaries/zh.json';

interface TooltipProps {
  term: string;
  children?: React.ReactNode;
}

export function Tooltip({ term, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const text = (dictionary as Record<string, string>)[term];

  if (!text) return children ?? <span>{term}</span>;

  return (
    <span
      className="relative inline-flex items-center gap-1 cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <span className="text-blue-500 text-xs border-b border-dashed border-blue-400">
        ⓘ
      </span>
      {show && (
        <span className="absolute bottom-full left-0 mb-1 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 z-50 shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

export function getTooltip(term: string): string {
  return (dictionary as Record<string, string>)[term] || '';
}
