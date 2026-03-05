'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import { PriceLine } from './trading-chart';

interface ManualPriceLinesProps {
  priceLines: PriceLine[];
  onAddPriceLine: (price: number, color: string, label: string) => void;
  onRemovePriceLine: (price: number, label: string) => void;
}

export default function ManualPriceLines({
  priceLines,
  onAddPriceLine,
  onRemovePriceLine,
}: ManualPriceLinesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [label, setLabel] = useState('');
  const [lineType, setLineType] = useState<'resistance' | 'support'>('resistance');

  const handleAdd = () => {
    const priceNum = Number.parseFloat(price);
    if (Number.isNaN(priceNum) || priceNum <= 0) return;

    const color = lineType === 'resistance' ? '#f6465d' : '#0ecb81';
    const prefix = lineType === 'resistance' ? 'R' : 'S';
    const finalLabel = label.trim() || `${prefix} ${priceNum.toFixed(2)}`;

    onAddPriceLine(priceNum, color, finalLabel);
    setPrice('');
    setLabel('');
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-1"
      >
        <Plus className="h-3 w-3" />
        Linhas
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg p-3 z-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium">Adicionar Linha</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setLineType('resistance')}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  lineType === 'resistance'
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                Resistência
              </button>
              <button
                type="button"
                onClick={() => setLineType('support')}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  lineType === 'support'
                    ? 'bg-success text-white'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                Suporte
              </button>
            </div>

            <Input
              type="number"
              step="0.01"
              placeholder="Preço"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-8 text-xs"
            />

            <Input
              type="text"
              placeholder="Label (opcional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-8 text-xs"
            />

            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!price}
              className="w-full h-7 text-xs"
            >
              Adicionar
            </Button>
          </div>

          {priceLines.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <span className="text-xs font-medium mb-2 block">Linhas Ativas</span>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {priceLines.map((line, idx) => (
                  <div
                    key={`${line.price}-${line.label}-${idx}`}
                    className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1"
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: line.color }}
                      />
                      {line.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemovePriceLine(line.price, line.label)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
