export interface PendingOrder {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  limitPrice: number;
  leverage: number;
  createdAt: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  entryTime: number;
  exitTime?: number;
  status: 'OPEN' | 'CLOSED';
  profit?: number;
  profitPercent?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
}

export interface Wallet {
  balance: number;
  usdt: number;
  positions: Record<string, { quantity: number; avgPrice: number }>;
}

export interface TradingState {
  wallet: Wallet;
  trades: Trade[];
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
}

export function createInitialWallet(initialBalance = 10000): Wallet {
  return {
    balance: initialBalance,
    usdt: initialBalance,
    positions: {},
  };
}

export function calculateTradeProfit(trade: Trade, currentPrice?: number): { profit: number; profitPercent: number } {
  // Se for operação aberta, usa preço atual para cálculo em tempo real
  const exitPrice = trade.exitPrice || currentPrice;
  if (!exitPrice) return { profit: 0, profitPercent: 0 };

  let profit: number;
  let profitPercent: number;

  if (trade.type === 'BUY') {
    // BUY: lucro quando preço sobe
    profit = (exitPrice - trade.entryPrice) * trade.quantity;
    profitPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
  } else {
    // SELL (SHORT): lucro quando preço cai
    profit = (trade.entryPrice - exitPrice) * trade.quantity;
    profitPercent = ((trade.entryPrice - exitPrice) / trade.entryPrice) * 100;
  }

  return { profit, profitPercent };
}

export function calculateWalletStats(trades: Trade[]): Omit<TradingState, 'wallet'> {
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const winTrades = closedTrades.filter(t => {
    const { profit } = calculateTradeProfit(t);
    return profit > 0;
  });
  const lossTrades = closedTrades.filter(t => {
    const { profit } = calculateTradeProfit(t);
    return profit < 0;
  });

  const totalProfit = winTrades.reduce((sum, t) => sum + (calculateTradeProfit(t).profit || 0), 0);
  const totalLoss = lossTrades.reduce((sum, t) => sum + (calculateTradeProfit(t).profit || 0), 0);

  return {
    trades,
    totalTrades: closedTrades.length,
    winTrades: winTrades.length,
    lossTrades: lossTrades.length,
    winRate: closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0,
    totalProfit,
    totalLoss,
  };
}
