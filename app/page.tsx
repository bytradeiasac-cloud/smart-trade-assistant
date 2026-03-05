'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { KlineData, TimeFrame } from '@/lib/bybit';
import { Indicator, PriceLine } from '@/components/trading-chart';
import TradingControls, { AVAILABLE_INDICATORS, PANEL_INDICATORS } from '@/components/trading-controls';
import CustomIndicators from '@/components/custom-indicators';
import ManualPriceLines from '@/components/manual-price-lines';
import PriceTicker from '@/components/price-ticker';
import AIChat from '@/components/ai-chat';
import IndicatorPanels from '@/components/indicator-panels';
import IndicatorBuilderChat from '@/components/indicator-builder-chat';
import WalletPanel from '@/components/wallet-panel';
import BuySellPanel from '@/components/buy-sell-panel';
import TradeHistory from '@/components/trade-history';
import { Wallet, Trade, PendingOrder, createInitialWallet, calculateWalletStats, calculateTradeProfit } from '@/lib/trading-context';

// Dynamic import for TradingChart to avoid SSR issues with lightweight-charts
const TradingChart = dynamic(() => import('@/components/trading-chart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-card">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading chart...</span>
      </div>
    </div>
  ),
});

export default function TradingDashboard() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState<TimeFrame>('1h');
  const [chartData, setChartData] = useState<KlineData[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>(AVAILABLE_INDICATORS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'simulator' | 'chat' | 'indicator'>('chat');
  const [priceLines, setPriceLines] = useState<PriceLine[]>([]);
  const [markers, setMarkers] = useState<any[]>([]);
  const [activePanels, setActivePanels] = useState<string[]>(['RSI', 'MACD']);
  const [ownedQuantity, setOwnedQuantity] = useState<number>(0); // Declare ownedQuantity

  // Trading state
  const [wallet, setWallet] = useState<Wallet>(() => createInitialWallet(10000));
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const tradingStats = calculateWalletStats(trades);

  const fetchChartData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/bybit?action=kline&symbol=${symbol}&interval=${timeframe}&limit=2000`
      );
      const result = await response.json();
      
      if (result.success) {
        setChartData(result.data);
        if (result.data.length > 0) {
          const lastCandle = result.data[result.data.length - 1];
          const firstCandle = result.data[0];
          setCurrentPrice(lastCandle.close);
          setPriceChange(((lastCandle.close - firstCandle.close) / firstCandle.close) * 100);
          setOwnedQuantity(wallet.positions[symbol]?.quantity || 0); // Update ownedQuantity
        }
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Failed to fetch chart data:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchChartData();
    const interval = setInterval(fetchChartData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchChartData]);

  const handleSymbolChange = (newSymbol: string) => {
    setSymbol(newSymbol);
  };

  const handleTimeframeChange = (newTimeframe: TimeFrame) => {
    setTimeframe(newTimeframe);
  };

  const handleIndicatorToggle = (toggledIndicator: Indicator) => {
    setIndicators((prev) =>
      prev.map((ind) =>
        ind.type === toggledIndicator.type && ind.period === toggledIndicator.period
          ? { ...ind, visible: toggledIndicator.visible }
          : ind
      )
    );
  };

  const handleAddIndicator = (indicator: Indicator) => {
    setIndicators((prev) => {
      const exists = prev.find(
        (i) => i.type === indicator.type && i.period === indicator.period
      );
      if (exists) {
        return prev.map((i) =>
          i.type === indicator.type && i.period === indicator.period
            ? { ...i, visible: true, color: indicator.color }
            : i
        );
      }
      return [...prev, { ...indicator, visible: true }];
    });
  };

  const handleRemoveIndicator = (type: string, period: number) => {
    setIndicators((prev) =>
      prev.map((i) =>
        i.type === type && i.period === period ? { ...i, visible: false } : i
      )
    );
  };

  const handleAddPriceLine = (price: number, color: string, label: string) => {
    setPriceLines((prev) => {
      const exists = prev.find((pl) => pl.price === price && pl.label === label);
      if (exists) return prev;
      return [...prev, { price, color, label }];
    });
  };

  const handleAddMarker = (marker: { time: number; position: 'aboveBar' | 'belowBar'; color: string; text: string }) => {
    setMarkers((prev) => {
      const exists = prev.find((m) => m.time === marker.time && m.text === marker.text);
      if (exists) return prev;
      return [...prev, marker];
    });
  };

  const handleRemovePriceLine = (price: number, label: string) => {
    setPriceLines((prev) => prev.filter((pl) => !(pl.price === price && pl.label === label)));
  };

  const handlePanelToggle = (panelName: string) => {
    setActivePanels((prev) =>
      prev.includes(panelName)
        ? prev.filter((p) => p !== panelName)
        : [...prev, panelName]
    );
  };

  const activeIndicators = indicators.filter((i) => i.visible);

  // Trading handlers
  const handleBuy = (quantity: number, price: number, leverage: number = 1, stopLoss?: number, takeProfit?: number) => {
    const cost = (quantity * price) / leverage;
    if (cost > wallet.usdt) return;

    const tradeId = Date.now().toString();
    const newTrade: Trade = {
      id: tradeId,
      symbol,
      type: 'BUY',
      quantity,
      entryPrice: price,
      entryTime: Date.now(),
      status: 'OPEN',
      stopLoss,
      takeProfit,
      leverage,
    };

    setWallet(prev => {
      const pos = prev.positions[symbol] || { quantity: 0, avgPrice: 0 };
      const totalQty = pos.quantity + quantity;
      const avgPrice = (pos.avgPrice * pos.quantity + price * quantity) / totalQty;

      return {
        ...prev,
        usdt: prev.usdt - cost,
        positions: {
          ...prev.positions,
          [symbol]: { quantity: totalQty, avgPrice },
        },
      };
    });

    setTrades(prev => [...prev, newTrade]);

    // Adiciona linhas visuais para stop loss e take profit
    if (stopLoss) {
      setPriceLines(prev => [...prev, {
        price: stopLoss,
        label: `SL ${stopLoss.toFixed(2)}`,
        color: '#ef4444',
      }]);
    }
    if (takeProfit) {
      setPriceLines(prev => [...prev, {
        price: takeProfit,
        label: `TP ${takeProfit.toFixed(2)}`,
        color: '#10b981',
      }]);
    }
  };

  const handleSell = (quantity: number, price: number, leverage: number = 1, stopLoss?: number, takeProfit?: number) => {
    const tradeId = Date.now().toString();
    
    // SHORT: vende sem ter a posição, usando saldo USDT como margem
    const revenue = quantity * price;
    const cost = revenue / leverage; // Custo com leverage

    if (cost > wallet.usdt) return; // Valida saldo para margem

    const newTrade: Trade = {
      id: tradeId,
      symbol,
      type: 'SELL',
      quantity,
      entryPrice: price, // Preço de entrada no SHORT
      exitPrice: undefined,
      entryTime: Date.now(),
      exitTime: undefined,
      status: 'OPEN',
      profit: undefined,
      profitPercent: undefined,
      stopLoss,
      takeProfit,
      leverage,
    };

    setWallet(prev => ({
      ...prev,
      usdt: prev.usdt - cost, // Usa saldo como margem
    }));

    setTrades(prev => [...prev, newTrade]);
  };

  const handleAddFunds = (amount: number) => {
    setWallet(prev => ({
      ...prev,
      balance: prev.balance + amount,
      usdt: prev.usdt + amount,
    }));
  };

  const handleWithdraw = (amount: number) => {
    if (amount > wallet.usdt) return;
    setWallet(prev => ({
      ...prev,
      balance: prev.balance - amount,
      usdt: prev.usdt - amount,
    }));
  };

  // Handler para fechar posição aberta
  const handleClosePosition = (tradeId: string) => {
    if (!currentPrice) return;
    
    const trade = trades.find(t => t.id === tradeId && t.status === 'OPEN');
    if (!trade) return;

    let profit: number;
    let profitPercent: number;

    if (trade.type === 'BUY') {
      // BUY: lucro quando preço sobe
      profit = (currentPrice - trade.entryPrice) * trade.quantity;
      profitPercent = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
    } else {
      // SELL (SHORT): lucro quando preço cai
      profit = (trade.entryPrice - currentPrice) * trade.quantity;
      profitPercent = ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;
    }

    setTrades(prev =>
      prev.map(t =>
        t.id === tradeId
          ? {
              ...t,
              exitPrice: currentPrice,
              exitTime: Date.now(),
              status: 'CLOSED' as const,
              profit,
              profitPercent,
            }
          : t
      )
    );

    setWallet(prev => ({
      ...prev,
      usdt: prev.usdt + profit, // Adiciona o lucro/perda ao saldo
    }));

    // Remove a linha da posição fechada do gráfico
    setPriceLines(prev => prev.filter(pl => !pl.label.includes(`[TRADE:${tradeId}]`)));

    // Remove a linha da posição fechada do gráfico
    setPriceLines(prev => prev.filter(pl => !pl.label.includes(`[TRADE:${tradeId}]`)));
  };

  // Handler para editar ordem pendente
  const handleEditOrder = (orderId: string, newPrice: number) => {
    setPendingOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, limitPrice: newPrice } : order
      )
    );

    // Atualiza a linha no gráfico
    setPriceLines(prev => {
      const filtered = prev.filter(pl => !pl.label.includes(orderId));
      return [
        ...filtered,
        {
          price: newPrice,
          label: `${orderId.substring(0, 8)} ${newPrice.toFixed(2)}`,
          color: '#10b981',
        },
      ];
    });
  };

  // Handler para cancelar ordem pendente
  const handleCancelOrder = (orderId: string) => {
    setPendingOrders(prev => prev.filter(order => order.id !== orderId));

    // Remove a linha do gráfico usando o padrão [ID:orderId]
    setPriceLines(prev =>
      prev.filter(pl => !pl.label.includes(`[ID:${orderId}]`))
    );
  };

  // Handler para criar ordem de limite
  const handleCreateLimitOrder = (quantity: number, limitPrice: number, orderType: 'BUY' | 'SELL', leverage: number = 1) => {
    const orderId = Date.now().toString();
    const newOrder: PendingOrder = {
      id: orderId,
      symbol,
      type: orderType,
      quantity,
      limitPrice,
      leverage,
      createdAt: Date.now(),
    };

    setPendingOrders(prev => [...prev, newOrder]);

    // Adiciona linha visual no gráfico para a ordem de limite - com ID para rastreamento
    setPriceLines(prev => [...prev, {
      price: limitPrice,
      label: `${orderType} ${quantity.toFixed(8)} @ $${limitPrice.toFixed(2)} [ID:${orderId}]`,
      color: orderType === 'BUY' ? '#10b981' : '#ef4444',
    }]);
  };

  // Sincroniza linhas de trades abertos no gráfico
  useEffect(() => {
    setPriceLines(prev => {
      // Remove todas as linhas de trades abertos
      let filtered = prev.filter(pl => !pl.label.includes('[TRADE:'));

      // Adiciona linhas para trades abertos
      trades.forEach(trade => {
        if (trade.status === 'OPEN') {
          filtered.push({
            price: trade.entryPrice,
            label: `${trade.type} ${trade.quantity.toFixed(8)} @ $${trade.entryPrice.toFixed(2)} [TRADE:${trade.id}]`,
            color: trade.type === 'BUY' ? '#3b82f6' : '#f59e0b', // Azul para BUY, Âmbar para SELL
          });
        }
      });

      return filtered;
    });
  }, [trades]);

  // Monitor de ordens pendentes - executa quando preço toca
  useEffect(() => {
    if (!currentPrice || pendingOrders.length === 0) return;

    pendingOrders.forEach(order => {
      const shouldExecute = 
        (order.type === 'BUY' && currentPrice <= order.limitPrice) ||
        (order.type === 'SELL' && currentPrice >= order.limitPrice);

      if (shouldExecute) {
        if (order.type === 'BUY') {
          handleBuy(order.quantity, order.limitPrice, order.leverage);
        } else {
          handleSell(order.quantity, order.limitPrice, order.leverage);
        }

        // Remove a ordem pendente e a linha do gráfico usando o ID
        setPendingOrders(prev => prev.filter(o => o.id !== order.id));
        setPriceLines(prev => prev.filter(pl => !pl.label.includes(`[ID:${order.id}]`)));
      }
    });
  }, [currentPrice, pendingOrders]);

  // Monitor stop loss e take profit
  useEffect(() => {
    if (!currentPrice) return;

    trades.forEach(trade => {
      if (trade.status !== 'OPEN') return;

      const shouldCloseSL = 
        (trade.type === 'BUY' && trade.stopLoss && currentPrice <= trade.stopLoss) ||
        (trade.type === 'SELL' && trade.stopLoss && currentPrice >= trade.stopLoss);

      const shouldCloseTP = 
        (trade.type === 'BUY' && trade.takeProfit && currentPrice >= trade.takeProfit) ||
        (trade.type === 'SELL' && trade.takeProfit && currentPrice <= trade.takeProfit);

      if (shouldCloseSL || shouldCloseTP) {
        const closePrice = shouldCloseSL && trade.stopLoss ? trade.stopLoss : trade.takeProfit;
        if (!closePrice) return;

        // Fecha a posição ao preço de SL ou TP
        const revenue = trade.quantity * closePrice;
        const profit = (closePrice - trade.entryPrice) * trade.quantity;

        setTrades(prev =>
          prev.map(t =>
            t.id === trade.id
              ? {
                  ...t,
                  exitPrice: closePrice,
                  exitTime: Date.now(),
                  status: 'CLOSED' as const,
                  profit,
                  profitPercent: ((closePrice - t.entryPrice) / t.entryPrice) * 100,
                }
              : t
          )
        );

        setWallet(prev => {
          const pos = prev.positions[trade.symbol];
          if (!pos) return prev;

          const newQty = pos.quantity - trade.quantity;
          return {
            ...prev,
            usdt: prev.usdt + revenue,
            positions: newQty <= 0
              ? (() => { const { [trade.symbol]: _, ...rest } = prev.positions; return rest; })()
              : { ...prev.positions, [trade.symbol]: { ...pos, quantity: newQty } },
          };
        });

        // Remove as linhas do gráfico
        setPriceLines(prev => 
          prev.filter(pl => pl.price !== trade.stopLoss && pl.price !== trade.takeProfit)
        );
      }
    });
  }, [currentPrice, trades]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-primary">ByTrade AI</h1>
          <span className="text-sm text-muted-foreground">Market Analyzer</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              isChatOpen
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            AI Chat
          </button>
        </div>
      </header>

      {/* Price Ticker */}
      <PriceTicker selectedSymbol={symbol} onSelectSymbol={handleSymbolChange} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Chart Area with Scrollable Content */}
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 border-b border-border sticky top-0 bg-card z-10">
            <TradingControls
              symbol={symbol}
              timeframe={timeframe}
              indicators={indicators}
              activePanels={activePanels}
              onSymbolChange={handleSymbolChange}
              onTimeframeChange={handleTimeframeChange}
              onIndicatorToggle={handleIndicatorToggle}
              onPanelToggle={handlePanelToggle}
            />
            
            <div className="ml-auto px-4 flex items-center gap-2">
              <ManualPriceLines
                priceLines={priceLines}
                onAddPriceLine={handleAddPriceLine}
                onRemovePriceLine={handleRemovePriceLine}
              />
            </div>
          </div>

          <CustomIndicators
            indicators={indicators}
            onIndicatorAdd={handleAddIndicator}
            onIndicatorRemove={handleRemoveIndicator}
          />

          <div className="flex-1 relative min-h-[400px]">
            {loading && chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full bg-card">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading chart data...</span>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full bg-card">
                <div className="flex flex-col items-center gap-3 text-center">
                  <svg className="w-12 h-12 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-destructive font-medium">{error}</p>
                  <button
                    type="button"
                    onClick={fetchChartData}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <TradingChart
                data={chartData}
                symbol={symbol}
                indicators={activeIndicators}
                priceLines={priceLines}
                markers={markers}
              />
            )}
          </div>

          {/* Indicator Panels (RSI, MACD, etc.) */}
          {chartData.length > 0 && !loading && (
            <div className="w-full bg-card border-t border-border">
              <IndicatorPanels data={chartData} visible={{
                rsi: activePanels.includes('RSI'),
                macd: activePanels.includes('MACD'),
                stochastic: activePanels.includes('Stochastic'),
                atr: activePanels.includes('ATR'),
                adx: activePanels.includes('ADX'),
                obv: activePanels.includes('OBV'),
                cci: activePanels.includes('CCI'),
                ichimoku: activePanels.includes('Ichimoku'),
                sar: activePanels.includes('SAR'),
              }} />
            </div>
          )}
        </div>

        {/* Sidebar Panel - Fixed */}
        {isChatOpen && (
          <div className="w-[400px] flex-shrink-0 border-l border-border h-full overflow-hidden flex flex-col bg-card">
            {/* Tabs Header */}
            <div className="flex items-center border-b border-border">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'chat'
                    ? 'border-primary text-primary bg-background/50'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                CHAT AI
              </button>
              <button
                onClick={() => setActiveTab('simulator')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'simulator'
                    ? 'border-primary text-primary bg-background/50'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                SIMULADOR
              </button>
              <button
                onClick={() => setActiveTab('indicator')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'indicator'
                    ? 'border-primary text-primary bg-background/50'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                INDICADOR
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto space-y-3 p-3">
              {/* SIMULATOR TAB */}
              {activeTab === 'simulator' && (
                <>
                  {/* Wallet Panel */}
                  <WalletPanel
                    wallet={wallet}
                    onAddFunds={handleAddFunds}
                    onWithdraw={handleWithdraw}
                  />

                  {/* Buy/Sell Panel */}
                  <BuySellPanel
                    symbol={symbol}
                    currentPrice={currentPrice}
                    onBuy={handleBuy}
                    onSell={handleSell}
                    onCreateLimitOrder={handleCreateLimitOrder}
                    onStopLossChange={(price) => {
                      setPriceLines(prev => {
                        const filtered = prev.filter(pl => !pl.label.includes('SL'));
                        return [...filtered, { price, label: `SL ${price.toFixed(2)}`, color: '#ef4444' }];
                      });
                    }}
                    onTakeProfitChange={(price) => {
                      setPriceLines(prev => {
                        const filtered = prev.filter(pl => !pl.label.includes('TP'));
                        return [...filtered, { price, label: `TP ${price.toFixed(2)}`, color: '#10b981' }];
                      });
                    }}
                    availableBalance={wallet.usdt}
                    ownedQuantity={ownedQuantity}
                  />

                  {/* Trade History */}
                  <TradeHistory
                    trades={tradingStats.trades}
                    pendingOrders={pendingOrders}
                    winRate={tradingStats.winRate}
                    totalProfit={tradingStats.totalProfit}
                    totalLoss={tradingStats.totalLoss}
                    totalTrades={tradingStats.totalTrades}
                    currentPrice={currentPrice || undefined}
                    onClosePosition={handleClosePosition}
                    onEditOrder={handleEditOrder}
                    onCancelOrder={handleCancelOrder}
                  />
                </>
              )}

              {/* CHAT AI TAB */}
              {activeTab === 'chat' && (
                <AIChat
                  symbol={symbol}
                  timeframe={timeframe}
                  currentPrice={currentPrice}
                  priceChange={priceChange}
                  indicators={indicators}
                  chartData={chartData}
                  onAddIndicator={handleAddIndicator}
                  onRemoveIndicator={handleRemoveIndicator}
                  onChangeTimeframe={handleTimeframeChange}
                  onChangePair={handleSymbolChange}
                  onAddPriceLine={handleAddPriceLine}
                />
              )}

              {/* INDICATOR TAB */}
              {activeTab === 'indicator' && (
                <IndicatorBuilderChat
                  chartData={chartData}
                  onAddMarker={handleAddMarker}
                  onClearMarkers={() => setMarkers([])}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
