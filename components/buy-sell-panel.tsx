'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BuySellPanelProps {
  symbol: string;
  currentPrice: number | null;
  onBuy: (quantity: number, price: number, leverage?: number) => void;
  onSell: (quantity: number, price: number, leverage?: number) => void;
  onCreateLimitOrder?: (quantity: number, limitPrice: number, orderType: 'BUY' | 'SELL', leverage: number) => void;
  onStopLossChange?: (price: number) => void;
  onTakeProfitChange?: (price: number) => void;
  availableBalance: number;
  ownedQuantity: number;
}

type OrderType = 'market' | 'limit';
type OrderSide = 'buy' | 'sell';

export default function BuySellPanel({
  symbol,
  currentPrice,
  onBuy,
  onSell,
  onCreateLimitOrder,
  onStopLossChange,
  onTakeProfitChange,
  availableBalance,
  ownedQuantity,
}: BuySellPanelProps) {
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [orderSide, setOrderSide] = useState<OrderSide>('buy');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [showSLTP, setShowSLTP] = useState(false);

  // Auto-update limit price quando currentPrice muda e em modo limit
  useEffect(() => {
    if (orderType === 'limit' && currentPrice && !limitPrice) {
      setLimitPrice(currentPrice.toString());
    }
  }, [currentPrice, orderType, limitPrice]);

  const price = orderType === 'market' ? currentPrice : parseFloat(limitPrice) || 0;
  const qty = parseFloat(quantity) || 0;
  const totalCost = qty * (price || 1);
  const leveragedCost = totalCost / leverage;

  // Cálculos de quantidade por percentual
  const handlePercentClick = (percent: number) => {
    const priceToUse = orderType === 'market' ? currentPrice : parseFloat(limitPrice) || currentPrice;
    if (!priceToUse || priceToUse <= 0) {
      return;
    }

    if (orderSide === 'buy') {
      // BUY: usa saldo USDT para comprar
      const availableAmount = (availableBalance * percent) / 100;
      const qty = availableAmount / priceToUse;
      setQuantity(qty.toFixed(8));
    } else {
      // SELL (SHORT): usa saldo USDT como margem para vender
      const availableAmount = (availableBalance * percent) / 100;
      const qty = availableAmount / priceToUse;
      setQuantity(qty.toFixed(8));
    }
  };

  const canExecute =
    qty > 0 &&
    (orderType === 'market'
      ? currentPrice !== null && currentPrice > 0
      : price > 0) &&
    (orderSide === 'buy'
      ? leveragedCost <= availableBalance
      : leveragedCost <= availableBalance); // SHORT também usa saldo USDT

  const handleExecute = () => {
    if (!canExecute || price === 0) return;

    const sl = stopLoss ? parseFloat(stopLoss) : undefined;
    const tp = takeProfit ? parseFloat(takeProfit) : undefined;

    if (orderType === 'limit' && onCreateLimitOrder) {
      onCreateLimitOrder(qty, price, orderSide === 'buy' ? 'BUY' : 'SELL', leverage);
    } else {
      if (orderSide === 'buy') {
        onBuy(qty, price, leverage, sl, tp);
      } else {
        onSell(qty, price, leverage, sl, tp);
      }
    }

    setQuantity('');
    setLimitPrice('');
    setLeverage(1);
    setStopLoss('');
    setTakeProfit('');
    setShowSLTP(false);
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-card border border-border rounded-lg">
      {/* Preço Atual */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Preço:</span>
        <span className="text-lg font-bold text-foreground">
          ${currentPrice ? currentPrice.toFixed(2) : '--'}
        </span>
      </div>

      <div className="h-px bg-border" />

      {/* Abas Compra/Venda */}
      <div className="flex gap-1">
        <Button
          variant={orderSide === 'buy' ? 'default' : 'outline'}
          size="sm"
          className={`flex-1 h-7 text-xs ${
            orderSide === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''
          }`}
          onClick={() => setOrderSide('buy')}
        >
          Comprar
        </Button>
        <Button
          variant={orderSide === 'sell' ? 'default' : 'outline'}
          size="sm"
          className={`flex-1 h-7 text-xs ${
            orderSide === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''
          }`}
          onClick={() => setOrderSide('sell')}
        >
          Vender
        </Button>
      </div>

      {/* Tipo de Ordem */}
      <Tabs value={orderType} onValueChange={(v) => setOrderType(v as OrderType)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-7">
          <TabsTrigger value="market" className="text-xs h-6">
            Mercado
          </TabsTrigger>
          <TabsTrigger value="limit" className="text-xs h-6">
            Limite
          </TabsTrigger>
        </TabsList>

        <TabsContent value="market" className="space-y-2 mt-2">
          <div className="text-xs text-muted-foreground">
            Compra/Venda executada ao preço de mercado atual
          </div>
        </TabsContent>

        <TabsContent value="limit" className="space-y-2 mt-2">
          <Input
            type="number"
            placeholder="Preço de entrada"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            className="h-7 text-xs"
            min="0"
            step="0.01"
          />
        </TabsContent>
      </Tabs>

      {/* Quantidade */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-muted-foreground">Quantidade</label>
          {orderSide === 'buy' && (
            <div className="flex gap-1">
              {[5, 10, 25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => handlePercentClick(pct)}
                  className="text-xs px-1.5 py-0.5 hover:bg-secondary rounded transition-colors"
                >
                  {pct}%
                </button>
              ))}
            </div>
          )}
          {orderSide === 'sell' && (
            <div className="flex gap-1">
              {[5, 10, 25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => handlePercentClick(pct)}
                  className="text-xs px-1.5 py-0.5 hover:bg-secondary rounded transition-colors"
                >
                  {pct}%
                </button>
              ))}
            </div>
          )}
        </div>
        <Input
          type="number"
          placeholder="Quantidade"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="h-7 text-xs"
          min="0"
          step="0.00000001"
        />
      </div>

      {/* Alavagem */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-muted-foreground">Alavagem</label>
          <span className="text-xs font-bold text-foreground">{leverage}x</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 5, 10, 20].map((lev) => (
            <button
              key={lev}
              onClick={() => setLeverage(lev)}
              className={`flex-1 text-xs py-1 rounded transition-colors ${
                leverage === lev
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border hover:bg-secondary'
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* Stop Loss e Take Profit */}
      <Button
        variant="outline"
        size="sm"
        className="w-full h-7 text-xs bg-transparent"
        onClick={() => setShowSLTP(!showSLTP)}
      >
        {showSLTP ? 'Ocultar' : 'Mostrar'} SL/TP
      </Button>

      {showSLTP && (
        <div className="space-y-2 p-2 bg-secondary/30 rounded">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs font-medium text-red-500">Stop Loss</label>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs px-2 ml-auto bg-transparent"
                onClick={() => {
                  const sl = parseFloat(stopLoss) || 0;
                  if (sl > 0) {
                    onStopLossChange?.(sl);
                  }
                }}
                disabled={!stopLoss || parseFloat(stopLoss) <= 0}
              >
                Criar Linha
              </Button>
            </div>
            <Input
              type="number"
              placeholder="Preço para fechar"
              value={stopLoss}
              onChange={(e) => {
                setStopLoss(e.target.value);
                // Atualizar linha em tempo real
                const price = parseFloat(e.target.value);
                if (price > 0) {
                  onStopLossChange?.(price);
                }
              }}
              className="h-7 text-xs"
              min="0"
              step="0.01"
            />
            {stopLoss && currentPrice && (
              <span className={`text-xs mt-1 block ${
                (orderSide === 'buy' && parseFloat(stopLoss) < currentPrice) ||
                (orderSide === 'sell' && parseFloat(stopLoss) > currentPrice)
                  ? 'text-red-500'
                  : 'text-muted-foreground'
              }`}>
                {Math.abs(((parseFloat(stopLoss) - currentPrice) / currentPrice) * 100).toFixed(2)}% risco
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs font-medium text-green-500">Take Profit</label>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs px-2 ml-auto bg-transparent"
                onClick={() => {
                  const tp = parseFloat(takeProfit) || 0;
                  if (tp > 0) {
                    onTakeProfitChange?.(tp);
                  }
                }}
                disabled={!takeProfit || parseFloat(takeProfit) <= 0}
              >
                Criar Linha
              </Button>
            </div>
            <Input
              type="number"
              placeholder="Preço para fechar"
              value={takeProfit}
              onChange={(e) => {
                setTakeProfit(e.target.value);
                // Atualizar linha em tempo real
                const price = parseFloat(e.target.value);
                if (price > 0) {
                  onTakeProfitChange?.(price);
                }
              }}
              className="h-7 text-xs"
              min="0"
              step="0.01"
            />
            {takeProfit && currentPrice && (
              <span className={`text-xs mt-1 block ${
                (orderSide === 'buy' && parseFloat(takeProfit) > currentPrice) ||
                (orderSide === 'sell' && parseFloat(takeProfit) < currentPrice)
                  ? 'text-green-500'
                  : 'text-muted-foreground'
              }`}>
                {Math.abs(((parseFloat(takeProfit) - currentPrice) / currentPrice) * 100).toFixed(2)}% alvo
              </span>
            )}
          </div>
        </div>
      )}

      {/* Resumo */}
      {qty > 0 && price > 0 && (
        <div className="bg-secondary/50 rounded p-2 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">${totalCost.toFixed(2)}</span>
          </div>
          {leverage > 1 && (
            <div className="flex justify-between text-yellow-600">
              <span>Com Alavagem:</span>
              <span className="font-medium">${leveragedCost.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {orderSide === 'buy' ? 'Saldo:' : 'Posição:'}
            </span>
            <span className="font-medium">
              {orderSide === 'buy'
                ? `$${availableBalance.toFixed(2)}`
                : `${ownedQuantity.toFixed(8)}`}
            </span>
          </div>
        </div>
      )}

      {/* Botão Executar */}
      <Button
        size="sm"
        className={`w-full h-8 font-medium text-sm ${
          orderSide === 'buy'
            ? 'bg-green-600 hover:bg-green-700 disabled:bg-gray-600'
            : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-600'
        }`}
        onClick={handleExecute}
        disabled={!canExecute}
      >
        {orderType === 'market' 
          ? `${orderSide === 'buy' ? 'Comprar' : 'Vender'} Mercado`
          : `Criar Ordem ${orderSide === 'buy' ? 'Compra' : 'Venda'} ${price > 0 ? `@ $${price.toFixed(2)}` : ''}`
        }
      </Button>

      {!canExecute && qty > 0 && (
        <div className="text-xs text-red-500 text-center">
          {price === 0 ? 'Preço inválido' : orderSide === 'buy' && leveragedCost > availableBalance ? 'Saldo insuficiente' : 'Quantidade inválida'}
        </div>
      )}
    </div>
  );
}
