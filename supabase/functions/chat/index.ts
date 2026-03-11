import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartContext {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  priceChange24h: number;
  indicators: { type: string; period: number }[];
  candles: Candle[];
  candleCount: number;
}

function calculateSMA(candles: Candle[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const sum = candles.slice(i - period + 1, i + 1).reduce((acc, c) => acc + c.close, 0);
    result.push(sum / period);
  }
  return result;
}

function calculateEMA(candles: Candle[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  const firstSMA = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period;
  result.push(firstSMA);
  for (let i = period; i < candles.length; i++) {
    const ema = (candles[i].close - result[result.length - 1]) * multiplier + result[result.length - 1];
    result.push(ema);
  }
  return result;
}

function findSupportResistance(candles: Candle[], currentPrice: number) {
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const allSupports: number[] = [];
  const allResistances: number[] = [];
  const window = 5;
  for (let i = window; i < candles.length - window; i++) {
    let isSupport = true;
    let isResistance = true;
    for (let j = 1; j <= window; j++) {
      if (lows[i] >= lows[i-j] || lows[i] >= lows[i+j]) isSupport = false;
      if (highs[i] <= highs[i-j] || highs[i] <= highs[i+j]) isResistance = false;
    }
    if (isSupport) allSupports.push(lows[i]);
    if (isResistance) allResistances.push(highs[i]);
  }
  const groupLevels = (levels: number[]): number[] => {
    if (levels.length === 0) return [];
    const sorted = [...new Set(levels)].sort((a, b) => b - a);
    const grouped: number[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.abs(sorted[i] - grouped[grouped.length - 1]) / grouped[grouped.length - 1];
      if (diff > 0.005) grouped.push(sorted[i]);
    }
    return grouped;
  };
  const supportsBelow = groupLevels(allSupports).filter(s => s < currentPrice).sort((a, b) => b - a).slice(0, 3);
  const resistancesAbove = groupLevels(allResistances).filter(r => r > currentPrice).sort((a, b) => a - b).slice(0, 3);
  return {
    supports: supportsBelow.length > 0 ? supportsBelow : groupLevels(allSupports).slice(0, 3),
    resistances: resistancesAbove.length > 0 ? resistancesAbove : groupLevels(allResistances).slice(0, 3),
  };
}

function analyzeTrend(candles: Candle[]): string {
  if (candles.length < 20) return 'Insufficient data';
  const sma20 = calculateSMA(candles, 20);
  const currentPrice = candles[candles.length - 1].close;
  const currentSMA = sma20[sma20.length - 1];
  const prevSMA = sma20[sma20.length - 10] || sma20[0];
  const priceVsSMA = currentPrice > currentSMA ? 'above' : 'below';
  const smaDirection = currentSMA > prevSMA ? 'rising' : 'falling';
  if (priceVsSMA === 'above' && smaDirection === 'rising') return 'BULLISH';
  if (priceVsSMA === 'below' && smaDirection === 'falling') return 'BEARISH';
  return 'NEUTRAL/CONSOLIDATING';
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('Failed after all retries');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, chartContext }: { messages: { role: string; content: string }[]; chartContext?: ChartContext } = await req.json();
    const apiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const candles = chartContext?.candles || [];
    const currentPrice = chartContext?.currentPrice || 0;
    let technicalData = '';

    if (candles.length >= 20) {
      const sma7 = calculateSMA(candles, 7);
      const sma20 = calculateSMA(candles, 20);
      const sma50 = candles.length >= 50 ? calculateSMA(candles, 50) : [];
      const sma200 = candles.length >= 200 ? calculateSMA(candles, 200) : [];
      const ema9 = calculateEMA(candles, 9);
      const ema21 = calculateEMA(candles, 21);
      const ema50 = candles.length >= 50 ? calculateEMA(candles, 50) : [];
      const ema200 = candles.length >= 200 ? calculateEMA(candles, 200) : [];
      const { supports, resistances } = findSupportResistance(candles, currentPrice);
      const trend = analyzeTrend(candles);

      const maAnalysis: string[] = [];
      const addMA = (name: string, values: number[]) => {
        if (values.length > 0) {
          const last = values[values.length - 1];
          const diff = ((currentPrice - last) / last * 100).toFixed(2);
          maAnalysis.push(`${name}: $${last.toFixed(2)} (price ${Number(diff) > 0 ? 'above' : 'below'} by ${Math.abs(Number(diff))}%)`);
        }
      };
      addMA('SMA7', sma7); addMA('SMA20', sma20); addMA('SMA50', sma50); addMA('SMA200', sma200);
      addMA('EMA9', ema9); addMA('EMA21', ema21); addMA('EMA50', ema50); addMA('EMA200', ema200);

      const highestHigh = Math.max(...candles.map(c => c.high));
      const lowestLow = Math.min(...candles.map(c => c.low));
      const priceRange = highestHigh - lowestLow;
      const positionInRange = ((currentPrice - lowestLow) / priceRange * 100).toFixed(1);
      const avgVolume = candles.reduce((acc, c) => acc + c.volume, 0) / candles.length;
      const recentVolume = candles.slice(-5).reduce((acc, c) => acc + c.volume, 0) / 5;
      const volumeTrend = recentVolume > avgVolume * 1.2 ? 'INCREASING' : recentVolume < avgVolume * 0.8 ? 'DECREASING' : 'NORMAL';

      technicalData = `
TECHNICAL ANALYSIS:
TREND: ${trend}
MOVING AVERAGES:
${maAnalysis.join('\n')}
KEY LEVELS:
- Resistências: ${resistances.map(r => '$' + r.toFixed(2)).join(', ') || 'None'}
- Suportes: ${supports.map(s => '$' + s.toFixed(2)).join(', ') || 'None'}
PRICE POSITION:
- Range: $${lowestLow.toFixed(2)} - $${highestHigh.toFixed(2)}
- Position in range: ${positionInRange}%
VOLUME: ${volumeTrend} (${((recentVolume / avgVolume) * 100).toFixed(0)}% of avg)
`;
    }

    const systemPrompt = `Você é um trader profissional de criptomoedas. Responda de forma direta e concisa.

DADOS DO MERCADO:
Símbolo: ${chartContext?.symbol || 'BTCUSDT'}
Timeframe: ${chartContext?.timeframe || '1h'}
Preço: $${currentPrice.toLocaleString()}
24h: ${chartContext?.priceChange24h?.toFixed(2) || 'N/A'}%
${technicalData}

ÚLTIMOS 5 CANDLES:
${candles.slice(-5).reverse().map((c, i) => `${i + 1}. O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume.toFixed(0)}`).join('\n')}

Inclua SEMPRE: 2+ médias móveis, resistências e suportes com valores exatos.
Finalize com: "Isso não é recomendação financeira."
Responda em português brasileiro.`;

    const geminiMessages = messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    geminiMessages.unshift({ role: 'user', parts: [{ text: `System Instructions: ${systemPrompt}` }] });
    geminiMessages.splice(1, 0, { role: 'model', parts: [{ text: 'Entendido. Vou analisar o gráfico em português.' }] });

    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
        }),
      }
    );

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Gemini API error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk);
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text-delta', textDelta: content })}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
      },
      flush(controller) {
        controller.enqueue(encoder.encode(`data: {"type":"finish","finishReason":"stop"}\n\n`));
      }
    });

    return new Response(response.body?.pipeThrough(transformStream), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});