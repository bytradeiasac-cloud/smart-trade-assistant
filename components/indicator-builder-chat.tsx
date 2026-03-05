'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KlineData } from '@/lib/bybit';
import { calculateEMAForIndicator } from '@/lib/technical-indicators';
import { X, Edit2 } from 'lucide-react';
import { calculateRSI, calculateMACD, calculateStochastic } from '@/lib/technical-indicators';

interface CustomIndicator {
  id: string;
  name: string;
  description: string;
  rules: string;
  buySignals: number[];
  sellSignals: number[];
  emaLines?: { period: number; values: (number | null)[] }[];
  stats?: {
    totalSignals: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfitPercent: number;
  };
  // Parâmetros editáveis
  params?: {
    ema1?: number;
    ema2?: number;
    ema3?: number;
    rsiPeriod?: number;
    rsiOverbought?: number;
    rsiBoundary?: number;
    stochPeriod?: number;
    stochSmoothK?: number;
    stochSmoothD?: number;
    stochBoundary?: number;
    stochOverbought?: number;
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface IndicatorBuilderChatProps {
  chartData: KlineData[];
  onAddMarker?: (marker: { time: number; position: 'aboveBar' | 'belowBar'; color: string; text: string }) => void;
  onClearMarkers?: () => void;
}

export default function IndicatorBuilderChat({
  chartData,
  onAddMarker,
  onClearMarkers,
}: IndicatorBuilderChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [customIndicators, setCustomIndicators] = useState<CustomIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);
  const [editParams, setEditParams] = useState<CustomIndicator['params'] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Função para alternar sinais de compra e venda
  const alternateSignals = (buySignals: number[], sellSignals: number[]) => {
    const allSignals = [
      ...buySignals.map(idx => ({ idx, type: 'buy' as const })),
      ...sellSignals.map(idx => ({ idx, type: 'sell' as const })),
    ].sort((a, b) => a.idx - b.idx);

    const alternatedBuy: number[] = [];
    const alternatedSell: number[] = [];
    let lastType: 'buy' | 'sell' | null = null;

    for (const signal of allSignals) {
      if (signal.type === 'buy' && lastType !== 'buy') {
        alternatedBuy.push(signal.idx);
        lastType = 'buy';
      } else if (signal.type === 'sell' && lastType === 'buy') {
        alternatedSell.push(signal.idx);
        lastType = 'sell';
      }
    }

    return { buySignals: alternatedBuy, sellSignals: alternatedSell };
  };

  const calculateIndicatorStats = (buySignals: number[], sellSignals: number[]) => {
    let wins = 0;
    let losses = 0;
    let totalProfitPercent = 0;

    // Para cada sinal de compra, verifica o próximo sinal de venda
    buySignals.forEach((buyIndex) => {
      const nextSellIndex = sellSignals.find((sellIdx) => sellIdx > buyIndex);
      if (nextSellIndex && chartData[buyIndex] && chartData[nextSellIndex]) {
        const buyPrice = chartData[buyIndex].close;
        const sellPrice = chartData[nextSellIndex].close;
        const profitPercent = ((sellPrice - buyPrice) / buyPrice) * 100;
        
        totalProfitPercent += profitPercent;
        
        if (profitPercent > 0) {
          wins++;
        } else {
          losses++;
        }
      }
    });

    // Para cada sinal de venda, verifica o próximo sinal de compra
    sellSignals.forEach((sellIndex) => {
      const nextBuyIndex = buySignals.find((buyIdx) => buyIdx > sellIndex);
      if (nextBuyIndex && chartData[sellIndex] && chartData[nextBuyIndex]) {
        const sellPrice = chartData[sellIndex].close;
        const buyPrice = chartData[nextBuyIndex].close;
        const profitPercent = ((sellPrice - buyPrice) / sellPrice) * 100;
        
        totalProfitPercent += profitPercent;
        
        if (profitPercent > 0) {
          wins++;
        } else {
          losses++;
        }
      }
    });

    const totalSignals = wins + losses;
    const winRate = totalSignals > 0 ? (wins / totalSignals) * 100 : 0;

    return {
      totalSignals,
      wins,
      losses,
      winRate,
      totalProfitPercent,
    };
  };

  const parseIndicatorSetup = (description: string) => {
    const lowerDesc = description.toLowerCase();
    const closes = chartData.map(c => c.close);
    
    // 0. Setup Combinado: EMA + Estocástico
    const hasEma = lowerDesc.includes('ema');
    const hasStoch = lowerDesc.includes('estocastico') || lowerDesc.includes('stochastic') || lowerDesc.includes('estocástico');
    
    const emaStochPattern = /ema\s*(\d+)\s*.*?ema\s*(\d+)\s*.*?(estocastico|stochastic|estocástico)/i;
    const emaStochMatch = description.match(emaStochPattern);
    
    if (emaStochMatch || (hasEma && hasStoch)) {
      // Extrai períodos das EMAs
      const emaPattern = /ema\s*(\d+)\s*.*?ema\s*(\d+)/i;
      const emaMatch = description.match(emaPattern);
      
      if (emaMatch) {
        const ema1Period = parseInt(emaMatch[1]);
        const ema2Period = parseInt(emaMatch[2]);
        
        const ema1Values = calculateEMAForIndicator(closes, ema1Period);
        const ema2Values = calculateEMAForIndicator(closes, ema2Period);
        const stochData = calculateStochastic(chartData, 14, 3, 3);

        const buySignals: number[] = [];
        const sellSignals: number[] = [];

        for (let i = 1; i < ema1Values.length; i++) {
          if (ema1Values[i] === null || ema2Values[i] === null) continue;
          if (stochData.k[i] === null || stochData.k[i - 1] === null) continue;

          // Compra: EMA curta acima da longa E Estocástico cruza para cima na zona de 20
          const emaCondition = ema1Values[i]! > ema2Values[i]!;
          const stochCrossUp = stochData.k[i - 1]! <= 20 && stochData.k[i]! > 20;
          
          if (emaCondition && stochCrossUp) {
            buySignals.push(i);
          }

          // Venda: Cruzamento inverso das médias OU Estocástico acima de 80
          const emaCrossDown = ema1Values[i - 1]! > ema2Values[i - 1]! && ema1Values[i]! <= ema2Values[i]!;
          const stochAbove80 = stochData.k[i]! > 80;
          
          if (emaCrossDown || stochAbove80) {
            sellSignals.push(i);
          }
        }

        // Alterna sinais para simular entradas e saídas reais
        const alternated = alternateSignals(buySignals, sellSignals);
        
        const stats = calculateIndicatorStats(alternated.buySignals, alternated.sellSignals);
        return {
          id: Date.now().toString(),
          name: `EMA ${ema1Period}/${ema2Period} + Estocástico`,
          description,
          rules: `Compra: EMA${ema1Period} acima EMA${ema2Period} E Estocástico cruza para cima em 20. Venda: Cruzamento inverso OU Estocástico > 80`,
          buySignals: alternated.buySignals,
          sellSignals: alternated.sellSignals,
          stats,
          emaLines: [
            { period: ema1Period, values: ema1Values },
            { period: ema2Period, values: ema2Values },
          ],
          params: {
            ema1: ema1Period,
            ema2: ema2Period,
            stochPeriod: 14,
            stochSmoothK: 3,
            stochSmoothD: 3,
            stochBoundary: 20,
            stochOverbought: 80,
          },
        };
      }
    }
    
    // 1. RSI Setup - "rsi abaixo de 30" ou "rsi sobrevenda"
    if (lowerDesc.includes('rsi') && (lowerDesc.includes('30') || lowerDesc.includes('sobrevenda') || lowerDesc.includes('sobrecompra') || lowerDesc.includes('70'))) {
      const rsiValues = calculateRSI(closes, 14);
      const buySignals: number[] = [];
      const sellSignals: number[] = [];

      for (let i = 1; i < rsiValues.length; i++) {
        if (rsiValues[i] === null || rsiValues[i - 1] === null) continue;
        
        // Compra: RSI sai de sobrevenda (cruza acima de 30)
        if (rsiValues[i - 1]! <= 30 && rsiValues[i]! > 30) {
          buySignals.push(i);
        }
        // Venda: RSI entra em sobrecompra (cruza acima de 70)
        if (rsiValues[i - 1]! <= 70 && rsiValues[i]! > 70) {
          sellSignals.push(i);
        }
      }

      const alternated = alternateSignals(buySignals, sellSignals);
      const stats = calculateIndicatorStats(alternated.buySignals, alternated.sellSignals);
      return {
        id: Date.now().toString(),
        name: 'RSI Reversão',
        description,
        rules: 'Compra quando RSI sai de sobrevenda (<30), venda quando entra em sobrecompra (>70)',
        buySignals: alternated.buySignals,
        sellSignals: alternated.sellSignals,
        stats,
        params: {
          rsiPeriod: 14,
          rsiBoundary: 30,
          rsiOverbought: 70,
        },
      };
    }

    // 2. MACD Setup - "macd cruza"
    if (lowerDesc.includes('macd')) {
      const macdData = calculateMACD(closes);
      const buySignals: number[] = [];
      const sellSignals: number[] = [];

      for (let i = 1; i < macdData.macd.length; i++) {
        if (macdData.macd[i] === null || macdData.signal[i] === null) continue;
        if (macdData.macd[i - 1] === null || macdData.signal[i - 1] === null) continue;

        const prevCross = macdData.macd[i - 1]! - macdData.signal[i - 1]!;
        const currCross = macdData.macd[i]! - macdData.signal[i]!;

        // MACD cruza acima da signal
        if (prevCross <= 0 && currCross > 0) {
          buySignals.push(i);
        }
        // MACD cruza abaixo da signal
        if (prevCross >= 0 && currCross < 0) {
          sellSignals.push(i);
        }
      }

      const alternated = alternateSignals(buySignals, sellSignals);
      const stats = calculateIndicatorStats(alternated.buySignals, alternated.sellSignals);
      return {
        id: Date.now().toString(),
        name: 'MACD Crossover',
        description,
        rules: 'Compra quando MACD cruza acima da linha de sinal, venda no cruzamento contrário',
        buySignals: alternated.buySignals,
        sellSignals: alternated.sellSignals,
        stats,
      };
    }

    // 3. Estocástico Setup
    if (lowerDesc.includes('estocastico') || lowerDesc.includes('stochastic')) {
      const stochData = calculateStochastic(chartData, 14, 3, 3);
      const buySignals: number[] = [];
      const sellSignals: number[] = [];

      for (let i = 1; i < stochData.k.length; i++) {
        if (stochData.k[i] === null || stochData.k[i - 1] === null) continue;
        
        // Compra: Estocástico cruza para cima na zona de 20
        if (stochData.k[i - 1]! <= 20 && stochData.k[i]! > 20) {
          buySignals.push(i);
        }
        // Venda: Estocástico acima de 80
        if (stochData.k[i - 1]! <= 80 && stochData.k[i]! > 80) {
          sellSignals.push(i);
        }
      }

      const alternated = alternateSignals(buySignals, sellSignals);
      const stats = calculateIndicatorStats(alternated.buySignals, alternated.sellSignals);
      return {
        id: Date.now().toString(),
        name: 'Estocástico Reversão',
        description,
        rules: 'Compra quando Estocástico sai de 20, venda quando atinge 80',
        buySignals: alternated.buySignals,
        sellSignals: alternated.sellSignals,
        stats,
        params: {
          stochPeriod: 14,
          stochSmoothK: 3,
          stochSmoothD: 3,
          stochBoundary: 20,
          stochOverbought: 80,
        },
      };
    }

    // 4. Setup de 3 Médias - "ema 5 cruza ema 8 acima ema 13"
    const threeEmaPattern = /ema\s*(\d+)\s*.*?ema\s*(\d+)\s*.*?ema\s*(\d+)/i;
    const threeMatches = description.match(threeEmaPattern);
    
    if (threeMatches) {
      const ema1Period = parseInt(threeMatches[1]);
      const ema2Period = parseInt(threeMatches[2]);
      const ema3Period = parseInt(threeMatches[3]);
      
      const ema1Values = calculateEMAForIndicator(closes, ema1Period);
      const ema2Values = calculateEMAForIndicator(closes, ema2Period);
      const ema3Values = calculateEMAForIndicator(closes, ema3Period);

      const buySignals: number[] = [];
      const sellSignals: number[] = [];

      for (let i = 1; i < ema1Values.length; i++) {
        if (ema1Values[i] === null || ema2Values[i] === null || ema3Values[i] === null) continue;
        if (ema1Values[i - 1] === null || ema2Values[i - 1] === null) continue;

        const prevCross = ema1Values[i - 1]! - ema2Values[i - 1]!;
        const currCross = ema1Values[i]! - ema2Values[i]!;

        // EMA1 cruza acima EMA2 e ambas acima EMA3
        if (prevCross <= 0 && currCross > 0 && ema1Values[i]! > ema3Values[i]! && ema2Values[i]! > ema3Values[i]!) {
          buySignals.push(i);
        }
        // EMA1 cruza abaixo EMA2
        if (prevCross >= 0 && currCross < 0) {
          sellSignals.push(i);
        }
      }

      const alternated = alternateSignals(buySignals, sellSignals);
      const stats = calculateIndicatorStats(alternated.buySignals, alternated.sellSignals);
      return {
        id: Date.now().toString(),
        name: `EMA ${ema1Period}/${ema2Period}/${ema3Period} Setup`,
        description,
        rules: `Compra quando EMA${ema1Period} cruza acima EMA${ema2Period} com ambas acima EMA${ema3Period}`,
        buySignals: alternated.buySignals,
        sellSignals: alternated.sellSignals,
        stats,
        emaLines: [
          { period: ema1Period, values: ema1Values },
          { period: ema2Period, values: ema2Values },
          { period: ema3Period, values: ema3Values },
        ],
      };
    }

    // 5. Setup de 2 EMAs (padrão - Golden Cross, etc)
    const emaPattern = /ema\s*(\d+)\s*(?:cruza|cross|cruzar|cruze)?.*?(?:com\s|with\s)?ema\s*(\d+)/i;
    const matches = description.match(emaPattern);

    if (matches) {
      const ema1Period = parseInt(matches[1]);
      const ema2Period = parseInt(matches[2]);
      
      const ema1Values = calculateEMAForIndicator(closes, ema1Period);
      const ema2Values = calculateEMAForIndicator(closes, ema2Period);

      const buySignals: number[] = [];
      const sellSignals: number[] = [];

      for (let i = 1; i < ema1Values.length; i++) {
        if (ema1Values[i] === null || ema2Values[i] === null) continue;
        if (ema1Values[i - 1] === null || ema2Values[i - 1] === null) continue;

        const prevCross = ema1Values[i - 1]! - ema2Values[i - 1]!;
        const currCross = ema1Values[i]! - ema2Values[i]!;

        // EMA curta cruza acima da longa (compra)
        if (prevCross <= 0 && currCross > 0) {
          buySignals.push(i);
        }
        // EMA curta cruza abaixo da longa (venda)
        else if (prevCross >= 0 && currCross < 0) {
          sellSignals.push(i);
        }
      }

      const alternated = alternateSignals(buySignals, sellSignals);
      const stats = calculateIndicatorStats(alternated.buySignals, alternated.sellSignals);

      const indicator: CustomIndicator = {
        id: Date.now().toString(),
        name: `EMA ${ema1Period}/${ema2Period} Crossover`,
        description,
        rules: `Compra quando EMA${ema1Period} cruza acima de EMA${ema2Period}, venda no cruzamento contrário`,
        buySignals: alternated.buySignals,
        sellSignals: alternated.sellSignals,
        stats,
        emaLines: [
          { period: ema1Period, values: ema1Values },
          { period: ema2Period, values: ema2Values },
        ],
      };

      return indicator;
    }

    return null;
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Processa o indicador
    const indicator = parseIndicatorSetup(input);
    
    if (indicator) {
      setCustomIndicators(prev => [...prev, indicator]);
      
      // Plota as setas de compra e venda no gráfico
      indicator.buySignals.forEach(index => {
        if (chartData[index] && onAddMarker) {
          onAddMarker({
            time: Math.floor(chartData[index].timestamp / 1000),
            position: 'belowBar',
            color: '#10b981',
            text: '↑',
          });
        }
      });

      indicator.sellSignals.forEach(index => {
        if (chartData[index] && onAddMarker) {
          onAddMarker({
            time: Math.floor(chartData[index].timestamp / 1000),
            position: 'aboveBar',
            color: '#ef4444',
            text: '↓',
          });
        }
      });
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `✓ Indicador criado: ${indicator.name}\n\nRegra: ${indicator.rules}\n\nEncontrados ${indicator.buySignals.length} sinais de compra e ${indicator.sellSignals.length} sinais de venda plotados no gráfico.`,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } else {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Descreva seu setup. Exemplo: "Compre quando EMA9 cruza acima da EMA21"',
      };
      setMessages(prev => [...prev, assistantMessage]);
    }

    setIsLoading(false);
  };

  const handleDeleteIndicator = (id: string) => {
    setCustomIndicators(prev => prev.filter(ind => ind.id !== id));
  };

  const handleEditIndicator = (indicator: CustomIndicator) => {
    setEditingIndicatorId(indicator.id);
    setEditParams({ ...indicator.params });
  };

  const handleUpdateParams = (newParams: CustomIndicator['params']) => {
    if (!editingIndicatorId) return;
    
    const indicatorToUpdate = customIndicators.find(ind => ind.id === editingIndicatorId);
    if (!indicatorToUpdate) return;

    // Recalcula os sinais com os novos parâmetros
    let updatedBuySignals: number[] = [];
    let updatedSellSignals: number[] = [];
    const closes = chartData.map(c => c.close);

    // Determina qual tipo de indicador é e recalcula
    if (indicatorToUpdate.name.includes('EMA') && indicatorToUpdate.name.includes('Estocástico')) {
      // Setup combinado EMA + Estocástico
      const ema1 = newParams?.ema1 || 9;
      const ema2 = newParams?.ema2 || 21;
      const ema1Values = calculateEMAForIndicator(closes, ema1);
      const ema2Values = calculateEMAForIndicator(closes, ema2);
      const stochBoundary = newParams?.stochBoundary || 20;
      const stochOverbought = newParams?.stochOverbought || 80;
      const stochData = calculateStochastic(chartData, newParams?.stochPeriod || 14, newParams?.stochSmoothK || 3, newParams?.stochSmoothD || 3);

      for (let i = 1; i < ema1Values.length; i++) {
        if (ema1Values[i] === null || ema2Values[i] === null || stochData.k[i] === null) continue;
        
        const emaCondition = ema1Values[i]! > ema2Values[i]!;
        const stochCrossUp = stochData.k[i - 1]! <= stochBoundary && stochData.k[i]! > stochBoundary;
        
        if (emaCondition && stochCrossUp) {
          updatedBuySignals.push(i);
        }

        const emaCrossDown = ema1Values[i - 1]! > ema2Values[i - 1]! && ema1Values[i]! <= ema2Values[i]!;
        const stochAbove = stochData.k[i]! > stochOverbought;
        
        if (emaCrossDown || stochAbove) {
          updatedSellSignals.push(i);
        }
      }
    } else if (indicatorToUpdate.name.includes('RSI')) {
      // Setup RSI
      const rsiPeriod = newParams?.rsiPeriod || 14;
      const rsiBoundary = newParams?.rsiBoundary || 30;
      const rsiOverbought = newParams?.rsiOverbought || 70;
      const rsiValues = calculateRSI(closes, rsiPeriod);

      for (let i = 1; i < rsiValues.length; i++) {
        if (rsiValues[i] === null || rsiValues[i - 1] === null) continue;
        
        if (rsiValues[i - 1]! <= rsiBoundary && rsiValues[i]! > rsiBoundary) {
          updatedBuySignals.push(i);
        }
        if (rsiValues[i - 1]! <= rsiOverbought && rsiValues[i]! > rsiOverbought) {
          updatedSellSignals.push(i);
        }
      }
    } else if (indicatorToUpdate.name.includes('Estocástico')) {
      // Setup Estocástico
      const stochPeriod = newParams?.stochPeriod || 14;
      const stochBoundary = newParams?.stochBoundary || 20;
      const stochOverbought = newParams?.stochOverbought || 80;
      const stochData = calculateStochastic(chartData, stochPeriod, newParams?.stochSmoothK || 3, newParams?.stochSmoothD || 3);

      for (let i = 1; i < stochData.k.length; i++) {
        if (stochData.k[i] === null) continue;
        
        if (stochData.k[i - 1]! <= stochBoundary && stochData.k[i]! > stochBoundary) {
          updatedBuySignals.push(i);
        }
        if (stochData.k[i - 1]! <= stochOverbought && stochData.k[i]! > stochOverbought) {
          updatedSellSignals.push(i);
        }
      }
    } else if (indicatorToUpdate.name.includes('EMA')) {
      // Setup EMA
      const ema1 = newParams?.ema1 || 9;
      const ema2 = newParams?.ema2 || 21;
      const ema1Values = calculateEMAForIndicator(closes, ema1);
      const ema2Values = calculateEMAForIndicator(closes, ema2);

      for (let i = 1; i < ema1Values.length; i++) {
        if (ema1Values[i] === null || ema2Values[i] === null) continue;
        if (ema1Values[i - 1] === null || ema2Values[i - 1] === null) continue;

        const prevCross = ema1Values[i - 1]! - ema2Values[i - 1]!;
        const currCross = ema1Values[i]! - ema2Values[i]!;

        if (prevCross <= 0 && currCross > 0) {
          updatedBuySignals.push(i);
        } else if (prevCross >= 0 && currCross < 0) {
          updatedSellSignals.push(i);
        }
      }
    }

    // Alterna os sinais
    const alternated = alternateSignals(updatedBuySignals, updatedSellSignals);
    const stats = calculateIndicatorStats(alternated.buySignals, alternated.sellSignals);

    // Atualiza o indicador
    const updatedIndicator = { 
      ...indicatorToUpdate,
      params: newParams,
      buySignals: alternated.buySignals,
      sellSignals: alternated.sellSignals,
      stats,
    };

    setCustomIndicators(prev =>
      prev.map(ind =>
        ind.id === editingIndicatorId ? updatedIndicator : ind
      )
    );

    // Atualiza os markers no gráfico
    onClearMarkers?.();
    
    updatedIndicator.buySignals.forEach(index => {
      if (chartData[index] && onAddMarker) {
        onAddMarker({
          time: Math.floor(chartData[index].timestamp / 1000),
          position: 'belowBar',
          color: '#22d3ee',
          text: '↑',
        });
      }
    });

    updatedIndicator.sellSignals.forEach(index => {
      if (chartData[index] && onAddMarker) {
        onAddMarker({
          time: Math.floor(chartData[index].timestamp / 1000),
          position: 'aboveBar',
          color: '#fb923c',
          text: '↓',
        });
      }
    });
    
    setEditingIndicatorId(null);
    setEditParams(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top: Chat Section (50%) */}
      <div className="flex-1 flex flex-col min-h-0 border-b border-border pb-4">
        <div className="flex-1 overflow-y-auto border border-border rounded-lg p-4 bg-background/50 mb-3">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <p>Descreva seu setup de trading</p>
                <p className="text-sm mt-2">Ex: "Compre quando EMA9 cruza acima da EMA21"</p>
              </div>
            )}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg">
                  <p className="text-sm">Processando...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
            placeholder="Digite seu setup..."
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4"
          >
            Enviar
          </Button>
        </div>
      </div>

      {/* Bottom: Indicators Section (50%) */}
      <div className="flex-1 flex flex-col min-h-0 pt-4">
        <p className="text-sm font-semibold mb-3">Indicadores Criados</p>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {customIndicators.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhum indicador criado ainda
            </p>
          ) : (
            customIndicators.map(indicator => (
              <div
                key={indicator.id}
                className="flex items-center justify-between p-3 bg-background/50 border border-border rounded-lg group hover:bg-background/80 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{indicator.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{indicator.rules}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sinais: {indicator.buySignals.length + indicator.sellSignals.length}
                  </p>
                  {indicator.stats && (
                    <div className="flex gap-3 mt-1 text-xs">
                      <span className="text-green-500">
                        Acertos: {indicator.stats.wins}
                      </span>
                      <span className="text-red-500">
                        Erros: {indicator.stats.losses}
                      </span>
                      <span className={indicator.stats.winRate >= 50 ? 'text-green-500' : 'text-red-500'}>
                        Taxa: {indicator.stats.winRate.toFixed(1)}%
                      </span>
                      <span className={indicator.stats.totalProfitPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
                        Lucro: {indicator.stats.totalProfitPercent.toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 bg-transparent"
                    onClick={() => handleEditIndicator(indicator)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 text-destructive bg-transparent"
                    onClick={() => handleDeleteIndicator(indicator.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Edição de Parâmetros */}
      {editingIndicatorId && editParams && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="font-semibold">Editar Parâmetros</h3>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {editParams.ema1 !== undefined && (
                <div>
                  <label className="text-xs font-medium">EMA 1 Período:</label>
                  <Input
                    type="number"
                    value={editParams.ema1}
                    onChange={e => setEditParams({ ...editParams, ema1: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              )}
              {editParams.ema2 !== undefined && (
                <div>
                  <label className="text-xs font-medium">EMA 2 Período:</label>
                  <Input
                    type="number"
                    value={editParams.ema2}
                    onChange={e => setEditParams({ ...editParams, ema2: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              )}
              {editParams.ema3 !== undefined && (
                <div>
                  <label className="text-xs font-medium">EMA 3 Período:</label>
                  <Input
                    type="number"
                    value={editParams.ema3}
                    onChange={e => setEditParams({ ...editParams, ema3: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              )}
              {editParams.rsiPeriod !== undefined && (
                <div>
                  <label className="text-xs font-medium">RSI Período:</label>
                  <Input
                    type="number"
                    value={editParams.rsiPeriod}
                    onChange={e => setEditParams({ ...editParams, rsiPeriod: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              )}
              {editParams.rsiBoundary !== undefined && (
                <div>
                  <label className="text-xs font-medium">RSI Sobrevenda:</label>
                  <Input
                    type="number"
                    value={editParams.rsiBoundary}
                    onChange={e => setEditParams({ ...editParams, rsiBoundary: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              )}
              {editParams.rsiOverbought !== undefined && (
                <div>
                  <label className="text-xs font-medium">RSI Sobrecompra:</label>
                  <Input
                    type="number"
                    value={editParams.rsiOverbought}
                    onChange={e => setEditParams({ ...editParams, rsiOverbought: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              )}
              {editParams.stochPeriod !== undefined && (
                <div>
                  <label className="text-xs font-medium">Estocástico Período:</label>
                  <Input
                    type="number"
                    value={editParams.stochPeriod}
                    onChange={e => setEditParams({ ...editParams, stochPeriod: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              )}
              {editParams.stochBoundary !== undefined && (
                <div>
                  <label className="text-xs font-medium">Estocástico Limiar Baixo:</label>
                  <Input
                    type="number"
                    value={editParams.stochBoundary}
                    onChange={e => setEditParams({ ...editParams, stochBoundary: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              )}
              {editParams.stochOverbought !== undefined && (
                <div>
                  <label className="text-xs font-medium">Estocástico Limiar Alto:</label>
                  <Input
                    type="number"
                    value={editParams.stochOverbought}
                    onChange={e => setEditParams({ ...editParams, stochOverbought: parseInt(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingIndicatorId(null);
                  setEditParams(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => handleUpdateParams(editParams)}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
