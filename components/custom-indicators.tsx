'use client';

import React from "react"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus } from 'lucide-react';
import { Indicator } from '@/components/trading-chart';

interface CustomIndicatorsProps {
  indicators: Indicator[];
  onIndicatorAdd: (indicator: Indicator) => void;
  onIndicatorRemove: (type: string, period: number) => void;
}

const INDICATOR_COLORS = [
  '#f7a600', '#3b82f6', '#8b5cf6', '#0ecb81', '#f6465d', 
  '#848e9c', '#10b981', '#f59e0b', '#ec4899', '#6366f1'
];

export default function CustomIndicators({
  indicators,
  onIndicatorAdd,
  onIndicatorRemove,
}: CustomIndicatorsProps) {
  const [selectedType, setSelectedType] = useState<'SMA' | 'EMA' | 'BB'>('EMA');
  const [period, setPeriod] = useState('');

  const handleAdd = () => {
    const periodNum = Number.parseInt(period);
    if (!periodNum || periodNum < 1 || periodNum > 500) return;

    // Check if already exists
    const exists = indicators.some(i => i.type === selectedType && i.period === periodNum);
    if (exists) return;

    // Get a color that's not being used
    const usedColors = indicators.map(i => i.color);
    const availableColor = INDICATOR_COLORS.find(c => !usedColors.includes(c)) || INDICATOR_COLORS[0];

    onIndicatorAdd({
      type: selectedType,
      period: periodNum,
      color: availableColor,
      visible: true,
    });

    setPeriod('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 border-t border-border bg-card">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Adicionar Indicador:</span>
        <Select value={selectedType} onValueChange={(v) => setSelectedType(v as any)}>
          <SelectTrigger className="w-[100px] h-8 bg-secondary border-border text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="SMA" className="hover:bg-accent text-xs">SMA</SelectItem>
            <SelectItem value="EMA" className="hover:bg-accent text-xs">EMA</SelectItem>
            <SelectItem value="BB" className="hover:bg-accent text-xs">Bollinger</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="Período"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          onKeyDown={handleKeyDown}
          min="1"
          max="500"
          className="w-[90px] h-8 bg-secondary border-border text-xs"
        />

        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!period || Number.parseInt(period) < 1}
          className="h-8 px-3 gap-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          Adicionar
        </Button>
      </div>

      {indicators.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Ativos:</span>
          {indicators.filter(i => i.visible).map((ind) => (
            <div
              key={`${ind.type}-${ind.period}`}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white"
              style={{ backgroundColor: ind.color }}
            >
              {ind.type}{ind.period}
              <button
                onClick={() => onIndicatorRemove(ind.type, ind.period)}
                className="hover:bg-black/20 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
