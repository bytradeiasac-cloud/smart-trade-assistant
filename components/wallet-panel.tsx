'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet } from '@/lib/trading-context';

interface WalletPanelProps {
  wallet: Wallet;
  onAddFunds: (amount: number) => void;
  onWithdraw: (amount: number) => void;
}

export default function WalletPanel({ wallet, onAddFunds, onWithdraw }: WalletPanelProps) {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'add' | 'withdraw'>('add');

  const handleSubmit = () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) return;

    if (mode === 'add') {
      onAddFunds(value);
    } else if (wallet.usdt >= value) {
      onWithdraw(value);
    }

    setAmount('');
  };

  const positionValue = Object.entries(wallet.positions).reduce((sum, [_symbol, pos]) => {
    if (!pos || pos.quantity <= 0) return sum;
    return sum + pos.quantity;
  }, 0);

  return (
    <div className="flex flex-col gap-3 p-3 bg-card border border-border rounded-lg">
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground font-medium">Saldo USDT</span>
        <div className="text-2xl font-bold text-foreground">
          ${wallet.usdt.toFixed(2)}
        </div>
        <span className="text-xs text-muted-foreground">
          Total: ${wallet.balance.toFixed(2)}
        </span>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Posições:</span>
          <span className="font-medium text-foreground">
            {Object.entries(wallet.positions)
              .filter(([_, pos]) => pos && pos.quantity > 0)
              .length}
          </span>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            variant={mode === 'add' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setMode('add')}
          >
            Adicionar
          </Button>
          <Button
            variant={mode === 'withdraw' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setMode('withdraw')}
          >
            Sacar
          </Button>
        </div>

        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Valor USDT"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="h-8 text-sm"
            min="0"
            step="0.01"
          />
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0}
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
