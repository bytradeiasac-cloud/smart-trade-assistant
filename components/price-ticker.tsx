'use client';

import { useEffect, useState } from 'react';
import { TickerData, getTickers } from '@/lib/bybit';

interface PriceTickerProps {
  onSelectSymbol: (symbol: string) => void;
  selectedSymbol: string;
}

export default function PriceTicker({ onSelectSymbol, selectedSymbol }: PriceTickerProps) {
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const response = await fetch('/api/bybit?action=tickers');
        const result = await response.json();
        if (result.success) {
          setTickers(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch tickers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickers();
    const interval = setInterval(fetchTickers, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-4 px-4 py-2 bg-card border-b border-border overflow-x-auto">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2 animate-pulse">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-card border-b border-border overflow-x-auto">
      {tickers.map((ticker) => {
        const priceChange = parseFloat(ticker.price24hPcnt) * 100;
        const isPositive = priceChange >= 0;
        const isSelected = ticker.symbol === selectedSymbol;

        return (
          <button
            key={ticker.symbol}
            type="button"
            onClick={() => onSelectSymbol(ticker.symbol)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
              isSelected
                ? 'bg-accent'
                : 'hover:bg-accent/50'
            }`}
          >
            <span className="text-sm font-medium text-foreground">
              {ticker.symbol.replace('USDT', '')}
            </span>
            <span className="text-sm font-semibold text-foreground">
              ${parseFloat(ticker.lastPrice).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: ticker.lastPrice.includes('.') 
                  ? Math.min(ticker.lastPrice.split('.')[1]?.length || 2, 6)
                  : 2,
              })}
            </span>
            <span
              className={`text-xs font-medium ${
                isPositive ? 'text-success' : 'text-destructive'
              }`}
            >
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
