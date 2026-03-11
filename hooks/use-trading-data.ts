'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Wallet, Trade, PendingOrder, createInitialWallet } from '@/lib/trading-context';
import type { User } from '@supabase/supabase-js';

export function useTradingData(user: User | null) {
  const [wallet, setWallet] = useState<Wallet>(() => createInitialWallet(10000));
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load data from Supabase
  const loadData = useCallback(async () => {
    if (!user) return;

    const [walletRes, tradesRes, ordersRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).single(),
      supabase.from('trades').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('pending_orders').select('*').eq('user_id', user.id),
    ]);

    if (walletRes.data) {
      setWallet({
        balance: Number(walletRes.data.balance),
        usdt: Number(walletRes.data.usdt),
        positions: (walletRes.data.positions as Record<string, { quantity: number; avgPrice: number }>) || {},
      });
    } else {
      // Create wallet for new user
      await supabase.from('wallets').insert({
        user_id: user.id,
        balance: 10000,
        usdt: 10000,
        positions: {},
      });
    }

    if (tradesRes.data) {
      setTrades(tradesRes.data.map(t => ({
        id: t.id,
        symbol: t.symbol,
        type: t.type as 'BUY' | 'SELL',
        quantity: Number(t.quantity),
        entryPrice: Number(t.entry_price),
        exitPrice: t.exit_price ? Number(t.exit_price) : undefined,
        entryTime: Number(t.entry_time),
        exitTime: t.exit_time ? Number(t.exit_time) : undefined,
        status: t.status as 'OPEN' | 'CLOSED',
        profit: t.profit ? Number(t.profit) : undefined,
        profitPercent: t.profit_percent ? Number(t.profit_percent) : undefined,
        stopLoss: t.stop_loss ? Number(t.stop_loss) : undefined,
        takeProfit: t.take_profit ? Number(t.take_profit) : undefined,
        leverage: t.leverage ? Number(t.leverage) : 1,
      })));
    }

    if (ordersRes.data) {
      setPendingOrders(ordersRes.data.map(o => ({
        id: o.id,
        symbol: o.symbol,
        type: o.type as 'BUY' | 'SELL',
        quantity: Number(o.quantity),
        limitPrice: Number(o.limit_price),
        leverage: o.leverage ? Number(o.leverage) : 1,
        createdAt: new Date(o.created_at).getTime(),
      })));
    }

    setDataLoaded(true);
  }, [user]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // Save wallet to Supabase
  const saveWallet = useCallback(async (newWallet: Wallet) => {
    if (!user) return;
    setWallet(newWallet);
    await supabase.from('wallets').update({
      balance: newWallet.balance,
      usdt: newWallet.usdt,
      positions: newWallet.positions,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);
  }, [user]);

  // Add trade to Supabase
  const addTrade = useCallback(async (trade: Trade) => {
    if (!user) return;
    setTrades(prev => [...prev, trade]);
    await supabase.from('trades').insert({
      id: trade.id,
      user_id: user.id,
      symbol: trade.symbol,
      type: trade.type,
      quantity: trade.quantity,
      entry_price: trade.entryPrice,
      exit_price: trade.exitPrice,
      entry_time: trade.entryTime,
      exit_time: trade.exitTime,
      status: trade.status,
      profit: trade.profit,
      profit_percent: trade.profitPercent,
      stop_loss: trade.stopLoss,
      take_profit: trade.takeProfit,
      leverage: trade.leverage,
    });
  }, [user]);

  // Update trade in Supabase
  const updateTrade = useCallback(async (tradeId: string, updates: Partial<Trade>) => {
    if (!user) return;
    setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, ...updates } : t));
    
    const dbUpdates: Record<string, unknown> = {};
    if (updates.exitPrice !== undefined) dbUpdates.exit_price = updates.exitPrice;
    if (updates.exitTime !== undefined) dbUpdates.exit_time = updates.exitTime;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.profit !== undefined) dbUpdates.profit = updates.profit;
    if (updates.profitPercent !== undefined) dbUpdates.profit_percent = updates.profitPercent;

    await supabase.from('trades').update(dbUpdates).eq('id', tradeId).eq('user_id', user.id);
  }, [user]);

  // Add pending order
  const addPendingOrder = useCallback(async (order: PendingOrder) => {
    if (!user) return;
    setPendingOrders(prev => [...prev, order]);
    await supabase.from('pending_orders').insert({
      id: order.id,
      user_id: user.id,
      symbol: order.symbol,
      type: order.type,
      quantity: order.quantity,
      limit_price: order.limitPrice,
      leverage: order.leverage,
    });
  }, [user]);

  // Update pending order
  const updatePendingOrder = useCallback(async (orderId: string, newPrice: number) => {
    if (!user) return;
    setPendingOrders(prev => prev.map(o => o.id === orderId ? { ...o, limitPrice: newPrice } : o));
    await supabase.from('pending_orders').update({ limit_price: newPrice }).eq('id', orderId).eq('user_id', user.id);
  }, [user]);

  // Remove pending order
  const removePendingOrder = useCallback(async (orderId: string) => {
    if (!user) return;
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    await supabase.from('pending_orders').delete().eq('id', orderId).eq('user_id', user.id);
  }, [user]);

  return {
    wallet,
    setWallet,
    trades,
    setTrades,
    pendingOrders,
    setPendingOrders,
    dataLoaded,
    saveWallet,
    addTrade,
    updateTrade,
    addPendingOrder,
    updatePendingOrder,
    removePendingOrder,
  };
}
