'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TRADING_PAIRS, TIMEFRAME_LABELS, TimeFrame } from '@/lib/bybit';
import { Indicator } from '@/components/trading-chart';

interface TradingControlsProps {
  symbol: string;
  timeframe: TimeFrame;
  indicators: Indicator[];
  activePanels: string[];
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: TimeFrame) => void;
  onIndicatorToggle: (indicator: Indicator) => void;
  onPanelToggle: (panelName: string) => void;
}

const AVAILABLE_INDICATORS: Indicator[] = [
  { type: 'SMA', period: 7, color: '#f7a600', visible: false },
  { type: 'SMA', period: 25, color: '#3b82f6', visible: false },
  { type: 'SMA', period: 99, color: '#8b5cf6', visible: false },
  { type: 'EMA', period: 9, color: '#0ecb81', visible: false },
  { type: 'EMA', period: 21, color: '#f6465d', visible: false },
  { type: 'BB', period: 20, color: '#848e9c', visible: false },
];

const PANEL_INDICATORS = [
  'RSI',
  'MACD',
  'Stochastic',
  'ATR',
  'ADX',
  'OBV',
  'CCI',
  'Ichimoku',
  'SAR',
];

export default function TradingControls({
  symbol,
  timeframe,
  indicators,
  activePanels,
  onSymbolChange,
  onTimeframeChange,
  onIndicatorToggle,
  onPanelToggle,
}: TradingControlsProps) {
  const isIndicatorActive = (type: string, period: number) => {
    return indicators.some((i) => i.type === type && i.period === period && i.visible);
  };

  return (
    <div className="flex flex-col gap-2 w-full p-2 sm:p-3 border-b border-border bg-card">
      {/* Row 1: Pair and Timeframes */}
      <div className="flex items-center gap-2 sm:gap-3 w-full flex-wrap">
        <Select value={symbol} onValueChange={onSymbolChange}>
          <SelectTrigger className="w-[110px] sm:w-[130px] h-8 bg-secondary border-border text-xs sm:text-sm">
            <SelectValue placeholder="Pair" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {TRADING_PAIRS.map((pair) => (
              <SelectItem key={pair} value={pair} className="hover:bg-accent text-xs sm:text-sm">
                {pair.replace('USDT', '/USDT')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0.5 px-1 py-1 rounded-md bg-secondary overflow-x-auto">
          {(Object.entries(TIMEFRAME_LABELS) as [TimeFrame, string][]).map(([value, label]) => (
            <Button
              key={value}
              variant={timeframe === value ? 'default' : 'ghost'}
              size="sm"
              className={`h-6 sm:h-7 px-1.5 sm:px-2.5 text-xs shrink-0 transition-colors ${
                timeframe === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onTimeframeChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Row 2: Panel Indicators */}
      <div className="flex items-center gap-1.5 flex-wrap w-full">
        <span className="text-xs text-muted-foreground font-medium shrink-0">Panels:</span>
        <div className="flex items-center gap-1 flex-wrap">
          {PANEL_INDICATORS.map((panelName) => {
            const isActive = activePanels.includes(panelName);
            return (
              <Button
                key={panelName}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className={`h-6 sm:h-7 px-1.5 sm:px-2 text-xs transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'
                }`}
                onClick={() => onPanelToggle(panelName)}
              >
                {panelName}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { AVAILABLE_INDICATORS, PANEL_INDICATORS };
