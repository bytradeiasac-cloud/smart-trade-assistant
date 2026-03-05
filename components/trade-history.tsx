'use client';

import { Trade, PendingOrder, calculateTradeProfit } from '@/lib/trading-context';
import { Button } from '@/components/ui/button';

interface TradeHistoryProps {
  trades: Trade[];
  pendingOrders?: PendingOrder[];
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  totalTrades: number;
  currentPrice?: number;
  onClosePosition?: (tradeId: string) => void;
  onEditOrder?: (orderId: string, newPrice: number) => void;
  onCancelOrder?: (orderId: string) => void;
}

export default function TradeHistory({
  trades,
  pendingOrders = [],
  winRate,
  totalProfit,
  totalLoss,
  totalTrades,
  currentPrice,
  onClosePosition,
  onEditOrder,
  onCancelOrder,
}: TradeHistoryProps) {
  const closedTrades = trades.filter(t => t.status === 'CLOSED').sort((a, b) => (b.exitTime || 0) - (a.exitTime || 0));
  const openTrades = trades.filter(t => t.status === 'OPEN');

  const totalNetProfit = totalProfit + totalLoss;
  const profitColor = totalNetProfit >= 0 ? 'text-green-500' : 'text-red-500';

  // Calcula lucro/prejuízo em tempo real de posições abertas
  const openTradesProfit = openTrades.reduce((sum, trade) => {
    const { profit } = calculateTradeProfit(trade, currentPrice);
    return sum + profit;
  }, 0);

  const totalWithOpenProfit = totalNetProfit + openTradesProfit;
  const totalWithOpenColor = totalWithOpenProfit >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="flex flex-col gap-3 p-3 bg-card border border-border rounded-lg">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 p-2 bg-background rounded">
          <span className="text-xs text-muted-foreground">Total Trades</span>
          <span className="text-lg font-bold text-foreground">{totalTrades}</span>
        </div>
        <div className="flex flex-col gap-1 p-2 bg-background rounded">
          <span className="text-xs text-muted-foreground">Win Rate</span>
          <span className="text-lg font-bold text-foreground">{winRate.toFixed(1)}%</span>
        </div>
        <div className="flex flex-col gap-1 p-2 bg-background rounded">
          <span className="text-xs text-muted-foreground">Lucro</span>
          <span className="text-sm font-bold text-green-500">${totalProfit.toFixed(2)}</span>
        </div>
        <div className="flex flex-col gap-1 p-2 bg-background rounded">
          <span className="text-xs text-muted-foreground">Prejuízo</span>
          <span className="text-sm font-bold text-red-500">${totalLoss.toFixed(2)}</span>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Net Profit - Closed Trades */}
      <div className="flex flex-col gap-1 p-2 bg-background rounded border border-border">
        <span className="text-xs text-muted-foreground">Lucro Líquido (Fechado)</span>
        <span className={`text-lg font-bold ${profitColor}`}>
          ${totalNetProfit.toFixed(2)}
        </span>
      </div>

      {/* Total with Open Trades */}
      {openTrades.length > 0 && (
        <div className="flex flex-col gap-1 p-2 bg-background rounded border border-yellow-600/50">
          <span className="text-xs text-muted-foreground">Lucro Total (Incluindo Abertos)</span>
          <span className={`text-lg font-bold ${totalWithOpenColor}`}>
            ${totalWithOpenProfit.toFixed(2)}
          </span>
        </div>
      )}

      {/* Pending Orders */}
      {pendingOrders.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">Ordens em Espera ({pendingOrders.length})</span>
          <div className="max-h-[180px] overflow-y-auto space-y-1.5">
            {pendingOrders.map(order => {
              const isPending = !order.symbol || !order.limitPrice;
              const distancePercent = currentPrice ? Math.abs((order.limitPrice - currentPrice) / currentPrice * 100) : 0;
              
              return (
                <div key={order.id} className="flex items-center justify-between p-2 bg-background/50 rounded text-xs border border-yellow-600/50">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-yellow-600">{order.type}</span>
                      <span className="text-muted-foreground">{order.symbol}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-600/20 text-yellow-600 rounded">EM ESPERA</span>
                    </div>
                    <span className="text-muted-foreground">
                      Qty: {order.quantity.toFixed(8)} | Limite: ${order.limitPrice.toFixed(2)}
                      {currentPrice && (
                        <span className="ml-2 text-[10px]">
                          ({distancePercent.toFixed(2)}% distância)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs bg-transparent"
                      onClick={() => {
                        const newPrice = prompt('Novo preço:', order.limitPrice.toString());
                        if (newPrice && !isNaN(parseFloat(newPrice))) {
                          onEditOrder?.(order.id, parseFloat(newPrice));
                        }
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs text-red-500 hover:text-red-600 bg-transparent"
                      onClick={() => onCancelOrder?.(order.id)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Open Trades */}
      {openTrades.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">Operações Abertas ({openTrades.length})</span>
          <div className="max-h-[180px] overflow-y-auto space-y-1.5">
            {openTrades.map(trade => {
              const { profit, profitPercent } = calculateTradeProfit(trade, currentPrice);
              const profitColor = profit >= 0 ? 'text-green-500' : 'text-red-500';

              return (
                <div key={trade.id} className="flex items-center justify-between p-2 bg-background rounded text-xs border border-border">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{trade.type}</span>
                      <span className="text-muted-foreground">{trade.symbol}</span>
                      {currentPrice && (
                        <span className={`font-bold ${profitColor}`}>
                          ${profit.toFixed(2)} ({profitPercent.toFixed(2)}%)
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      Qty: {trade.quantity.toFixed(8)} | Entry: ${trade.entryPrice.toFixed(2)}
                      {currentPrice && ` | Preço Atual: $${currentPrice.toFixed(2)}`}
                    </span>
                    {(trade.stopLoss || trade.takeProfit) && (
                      <span className="text-muted-foreground text-[10px]">
                        {trade.stopLoss && <span>SL: ${trade.stopLoss.toFixed(2)} </span>}
                        {trade.takeProfit && <span>TP: ${trade.takeProfit.toFixed(2)}</span>}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs ml-2 bg-transparent"
                    onClick={() => onClosePosition?.(trade.id)}
                  >
                    Fechar
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Closed Trades */}
      {closedTrades.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">Histórico de Trades ({closedTrades.length})</span>
          <div className="max-h-[200px] overflow-y-auto space-y-1">
            {closedTrades.map(trade => {
              const { profit, profitPercent } = calculateTradeProfit(trade);
              const profitColor = profit >= 0 ? 'text-green-500' : 'text-red-500';

              return (
                <div key={trade.id} className="flex items-center justify-between p-2 bg-background rounded text-xs border border-border">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{trade.type}</span>
                      <span className="text-muted-foreground">{trade.symbol}</span>
                      <span className={`font-bold ${profitColor}`}>
                        ${profit.toFixed(2)} ({profitPercent.toFixed(2)}%)
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      Qty: {trade.quantity.toFixed(8)} | Entry: ${trade.entryPrice.toFixed(2)} | Exit: ${trade.exitPrice?.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {closedTrades.length === 0 && openTrades.length === 0 && (
        <div className="flex items-center justify-center py-4">
          <span className="text-xs text-muted-foreground">Nenhum trade realizado</span>
        </div>
      )}
    </div>
  );
}
