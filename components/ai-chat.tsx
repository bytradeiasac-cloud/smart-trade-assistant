'use client';

import React from "react"

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { KlineData, TimeFrame } from '@/lib/bybit';
import { Indicator } from '@/components/trading-chart';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedLevels?: {
    resistances: number[];
    supports: number[];
  };
  suggestedMAs?: {
    type: 'SMA' | 'EMA';
    period: number;
  }[];
}

interface AIChatProps {
  symbol: string;
  timeframe: TimeFrame;
  currentPrice: number | null;
  priceChange: number;
  indicators: Indicator[];
  chartData: KlineData[];
  onAddIndicator: (indicator: Indicator) => void;
  onRemoveIndicator: (type: string, period: number) => void;
  onChangeTimeframe: (timeframe: TimeFrame) => void;
  onChangePair: (symbol: string) => void;
  onAddPriceLine?: (price: number, color: string, label: string) => void;
}

export default function AIChat({
  symbol,
  timeframe,
  currentPrice,
  priceChange,
  indicators,
  chartData,
  onAddIndicator,
  onAddPriceLine,
}: AIChatProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    const chartContext = {
      symbol,
      timeframe,
      currentPrice: currentPrice || 0,
      priceChange24h: priceChange,
      indicators: indicators.filter(i => i.visible).map(i => ({ type: i.type, period: i.period })),
      candles: chartData.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      })),
      candleCount: chartData.length,
    };

    try {
      
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          chartContext,
        }),
      });

      

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      // Read the stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantId = (Date.now() + 1).toString();

      // Add empty assistant message
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', suggestedLevels: { resistances: [], supports: [] }, suggestedMAs: [] }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text-delta' && data.textDelta) {
                assistantContent += data.textDelta;
                setMessages(prev => 
                  prev.map(m => 
                    m.id === assistantId 
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Extract levels and MAs from the response
      const resistances: number[] = [];
      const supports: number[] = [];
      const mas: { type: 'SMA' | 'EMA'; period: number }[] = [];

      // Extract resistance and support levels
      console.log('[v0] Extracting levels from:', assistantContent.substring(0, 200));
      
      // Match complete numbers: $113633.57 or $113,633.57 or $113.633,57
      const priceRegex = /\$\s*(\d{1,7}(?:[.,]\d{2,3})?)/g;
      const resistanceMatch = assistantContent.match(/resist[êe]ncia[s]?[:\s]+([^\n.]+)/gi);
      const supportMatch = assistantContent.match(/suporte[s]?[:\s]+([^\n.]+)/gi);

      console.log('[v0] Resistance matches:', resistanceMatch);
      console.log('[v0] Support matches:', supportMatch);

      if (resistanceMatch) {
        resistanceMatch.forEach(match => {
          const prices = match.match(priceRegex);
          console.log('[v0] Prices found in resistance:', prices);
          if (prices) {
            prices.forEach(price => {
              // Remove $ and spaces
              let cleanPrice = price.replace(/[$\s]/g, '');
              
              // Replace comma with dot for decimal (handle both 113633.57 and 113633,57)
              cleanPrice = cleanPrice.replace(',', '.');
              
              const value = Number.parseFloat(cleanPrice);
              console.log('[v0] Parsed resistance value:', price, '→', cleanPrice, '→', value);
              if (!Number.isNaN(value) && value > 0) resistances.push(value);
            });
          }
        });
      }

      if (supportMatch) {
        supportMatch.forEach(match => {
          const prices = match.match(priceRegex);
          console.log('[v0] Prices found in support:', prices);
          if (prices) {
            prices.forEach(price => {
              // Remove $ and spaces
              let cleanPrice = price.replace(/[$\s]/g, '');
              
              // Replace comma with dot for decimal
              cleanPrice = cleanPrice.replace(',', '.');
              
              const value = Number.parseFloat(cleanPrice);
              console.log('[v0] Parsed support value:', price, '→', cleanPrice, '→', value);
              if (!Number.isNaN(value) && value > 0) supports.push(value);
            });
          }
        });
      }

      console.log('[v0] Final resistances:', resistances);
      console.log('[v0] Final supports:', supports);

      // Extract MAs (SMA7, EMA21, etc)
      const maRegex = /(SMA|EMA)(\d+)/gi;
      const maMatches = assistantContent.matchAll(maRegex);
      for (const match of maMatches) {
        const type = match[1].toUpperCase() as 'SMA' | 'EMA';
        const period = Number.parseInt(match[2]);
        if (!Number.isNaN(period) && !mas.some(m => m.type === type && m.period === period)) {
          mas.push({ type, period });
        }
      }

      // Update message with extracted data
      setMessages(prev => 
        prev.map(m => 
          m.id === assistantId 
            ? { 
                ...m, 
                suggestedLevels: { 
                  resistances: [...new Set(resistances)].slice(0, 3), 
                  supports: [...new Set(supports)].slice(0, 3) 
                },
                suggestedMAs: mas.slice(0, 5)
              }
            : m
        )
      );

      

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <h3 className="font-semibold text-foreground">AI Analyst</h3>
        </div>
        <span className="text-xs text-muted-foreground">Gemini 1.5</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent" ref={scrollRef}>
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-3 p-4 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground">
                Olá! Posso ajudar você a analisar o gráfico de {symbol}. Tente perguntar:
              </p>
              <div className="flex flex-col gap-2">
                {[
                  'Analise a tendência atual',
                  'O que você vê neste gráfico?',
                  'Identifique suporte e resistência',
                  'Quais padrões estão se formando?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="text-left text-xs px-3 py-2 rounded bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col gap-1 ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
              
              {/* Plot buttons for assistant messages */}
              {message.role === 'assistant' && onAddPriceLine && (message.suggestedLevels || message.suggestedMAs) && (
                <div className="flex flex-wrap gap-1 mt-1 max-w-[90%]">
                  {message.suggestedLevels?.resistances && message.suggestedLevels.resistances.length > 0 && (
                    message.suggestedLevels.resistances.map((price, idx) => (
                      <button
                        key={`r-${idx}`}
                        type="button"
                        onClick={() => onAddPriceLine(price, '#f6465d', `R ${price.toFixed(2)}`)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        R ${price.toFixed(2)}
                      </button>
                    ))
                  )}
                  {message.suggestedLevels?.supports && message.suggestedLevels.supports.length > 0 && (
                    message.suggestedLevels.supports.map((price, idx) => (
                      <button
                        key={`s-${idx}`}
                        type="button"
                        onClick={() => onAddPriceLine(price, '#0ecb81', `S ${price.toFixed(2)}`)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success hover:bg-success/20 transition-colors"
                      >
                        S ${price.toFixed(2)}
                      </button>
                    ))
                  )}
                  {message.suggestedMAs && message.suggestedMAs.length > 0 && (
                    message.suggestedMAs.map((ma, idx) => (
                      <button
                        key={`ma-${idx}`}
                        type="button"
                        onClick={() => {
                          const colors = ['#f7a600', '#3a7bd5', '#00d4aa', '#ff6b6b', '#9b59b6'];
                          onAddIndicator({
                            type: ma.type,
                            period: ma.period,
                            color: colors[idx % colors.length],
                            visible: true,
                          });
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        {ma.type}{ma.period}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex items-start">
              <div className="bg-secondary rounded-lg px-3 py-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faça perguntas sobre o gráfico..."
            disabled={isLoading}
            className="flex-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Isso não é recomendação financeira. Apenas para fins educacionais.
        </p>
      </form>
    </div>
  );
}
