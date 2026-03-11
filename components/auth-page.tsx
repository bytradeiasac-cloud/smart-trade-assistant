'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AuthPageProps {
  onSignIn: (email: string, password: string) => Promise<{ error: any }>;
  onSignUp: (email: string, password: string, username?: string) => Promise<{ error: any }>;
  loading: boolean;
}

export default function AuthPage({ onSignIn, onSignUp, loading }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'login') {
      const { error } = await onSignIn(email, password);
      if (error) setError(error.message);
    } else {
      const { error } = await onSignUp(email, password, username);
      if (error) setError(error.message);
      else setSuccess('Conta criada! Verifique seu email para confirmar.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary">ByTrade AI</h1>
          <p className="text-muted-foreground">Market Analyzer & Trading Simulator</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === 'login' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
            >
              Login
            </Button>
            <Button
              variant={mode === 'signup' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
            >
              Criar Conta
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <Input
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-500">{success}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Carregando...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
