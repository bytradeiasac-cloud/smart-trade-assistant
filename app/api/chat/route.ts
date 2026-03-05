import { UIMessage } from 'ai';

export const maxDuration = 60;

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

// Calculate SMA
function calculateSMA(candles: Candle[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const sum = candles.slice(i - period + 1, i + 1).reduce((acc, c) => acc + c.close, 0);
    result.push(sum / period);
  }
  return result;
}

// Calculate EMA
function calculateEMA(candles: Candle[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA is SMA
  const firstSMA = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period;
  result.push(firstSMA);
  
  for (let i = period; i < candles.length; i++) {
    const ema = (candles[i].close - result[result.length - 1]) * multiplier + result[result.length - 1];
    result.push(ema);
  }
  return result;
}

// Calculate volume profile to identify high-volume zones
function findVolumeProfile(candles: Candle[]): { levels: number[]; description: string } {
  if (candles.length === 0) return { levels: [], description: '' };
  
  // Create price buckets (20 buckets across the range)
  const highestHigh = Math.max(...candles.map(c => c.high));
  const lowestLow = Math.min(...candles.map(c => c.low));
  const range = highestHigh - lowestLow;
  const bucketSize = range / 20;
  
  // Map each candle to volume buckets
  const volumeBuckets: { price: number; volume: number }[] = [];
  for (let i = 0; i < 20; i++) {
    volumeBuckets.push({
      price: lowestLow + (i + 0.5) * bucketSize,
      volume: 0,
    });
  }
  
  // Accumulate volume in buckets
  candles.forEach(candle => {
    const centerPrice = (candle.high + candle.low) / 2;
    const bucketIndex = Math.floor((centerPrice - lowestLow) / bucketSize);
    const index = Math.min(Math.max(bucketIndex, 0), 19);
    volumeBuckets[index].volume += candle.volume;
  });
  
  // Find high-volume zones (top 30% by volume)
  const avgVolume = volumeBuckets.reduce((sum, b) => sum + b.volume, 0) / volumeBuckets.length;
  const highVolumeLevels = volumeBuckets
    .filter(b => b.volume > avgVolume * 1.5)
    .map(b => b.price)
    .sort((a, b) => b - a);
  
  let description = '';
  if (highVolumeLevels.length > 0) {
    description = `Alto volume identificado em: ${highVolumeLevels.slice(0, 3).map(p => '$' + p.toFixed(2)).join(', ')}`;
  }
  
  return { levels: highVolumeLevels.slice(0, 3), description };
}

// Enhance support and resistance with volume profile
function findSupportResistance(candles: Candle[], currentPrice: number): { supports: number[]; resistances: number[] } {
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  
  const allSupports: number[] = [];
  const allResistances: number[] = [];
  
  // Find local minima (supports) and maxima (resistances) usando janela maior
  const window = 5;
  for (let i = window; i < candles.length - window; i++) {
    // Check if it's a local minimum (support)
    let isSupport = true;
    for (let j = 1; j <= window; j++) {
      if (lows[i] >= lows[i-j] || lows[i] >= lows[i+j]) {
        isSupport = false;
        break;
      }
    }
    if (isSupport) allSupports.push(lows[i]);
    
    // Check if it's a local maximum (resistance)
    let isResistance = true;
    for (let j = 1; j <= window; j++) {
      if (highs[i] <= highs[i-j] || highs[i] <= highs[i+j]) {
        isResistance = false;
        break;
      }
    }
    if (isResistance) allResistances.push(highs[i]);
  }
  
  // Remove duplicates e agrupa níveis próximos (dentro de 0.5%)
  const groupLevels = (levels: number[]): number[] => {
    if (levels.length === 0) return [];
    const sorted = [...new Set(levels)].sort((a, b) => b - a);
    const grouped: number[] = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.abs(sorted[i] - grouped[grouped.length - 1]) / grouped[grouped.length - 1];
      if (diff > 0.005) { // 0.5% difference
        grouped.push(sorted[i]);
      }
    }
    return grouped;
  };
  
  const groupedSupports = groupLevels(allSupports);
  const groupedResistances = groupLevels(allResistances);
  
  // Prioriza níveis mais próximos ao preço atual
  const supportsBelow = groupedSupports.filter(s => s < currentPrice).sort((a, b) => b - a).slice(0, 3);
  const resistancesAbove = groupedResistances.filter(r => r > currentPrice).sort((a, b) => a - b).slice(0, 3);
  
  return { 
    supports: supportsBelow.length > 0 ? supportsBelow : groupedSupports.slice(0, 3),
    resistances: resistancesAbove.length > 0 ? resistancesAbove : groupedResistances.slice(0, 3)
  };
}

// Analyze trend
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

// Retry com backoff exponencial para erros 429
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Se for 429, aguarda e tenta novamente
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : Math.pow(2, attempt) * 1000; // Backoff exponencial: 1s, 2s, 4s
        
        console.log(`[v0] Rate limited. Tentativa ${attempt + 1}/${maxRetries}. Aguardando ${waitTime}ms...`);
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`[v0] Erro na requisição. Tentativa ${attempt + 1}/${maxRetries}. Aguardando ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error('Falha após todas as tentativas');
}

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }
  
  const { messages, chartContext }: { messages: UIMessage[]; chartContext?: ChartContext } = body;
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Calculate technical analysis data
  const candles = chartContext?.candles || [];
  const currentPrice = chartContext?.currentPrice || 0;
  
  console.log('[v0] Analysis Request - Timeframe:', chartContext?.timeframe, 'Candles received:', candles.length, 'Symbol:', chartContext?.symbol);
  
  let technicalData = '';
  
  if (candles.length >= 20) {
    console.log('[v0] Calculating indicators for', candles.length, 'candles');
    const sma7 = calculateSMA(candles, 7);
    const sma20 = calculateSMA(candles, 20);
    const sma50 = candles.length >= 50 ? calculateSMA(candles, 50) : [];
    const sma99 = candles.length >= 99 ? calculateSMA(candles, 99) : [];
    const sma200 = candles.length >= 200 ? calculateSMA(candles, 200) : [];
    const ema9 = calculateEMA(candles, 9);
    const ema21 = calculateEMA(candles, 21);
    const ema50 = candles.length >= 50 ? calculateEMA(candles, 50) : [];
    const ema100 = candles.length >= 100 ? calculateEMA(candles, 100) : [];
    const ema200 = candles.length >= 200 ? calculateEMA(candles, 200) : [];
    
    const { supports, resistances } = findSupportResistance(candles, currentPrice);
    const { levels: volumeHighZones, description: volumeDescription } = findVolumeProfile(candles);
    const trend = analyzeTrend(candles);
    
    // Calculate which MAs are most relevant
    const maAnalysis: string[] = [];
    
    if (sma7.length > 0) {
      const lastSMA7 = sma7[sma7.length - 1];
      const diff7 = ((currentPrice - lastSMA7) / lastSMA7 * 100).toFixed(2);
      maAnalysis.push(`SMA7: $${lastSMA7.toFixed(2)} (price ${Number(diff7) > 0 ? 'above' : 'below'} by ${Math.abs(Number(diff7))}%)`);
    }
    if (sma20.length > 0) {
      const lastSMA20 = sma20[sma20.length - 1];
      const diff20 = ((currentPrice - lastSMA20) / lastSMA20 * 100).toFixed(2);
      maAnalysis.push(`SMA20: $${lastSMA20.toFixed(2)} (price ${Number(diff20) > 0 ? 'above' : 'below'} by ${Math.abs(Number(diff20))}%)`);
    }
    if (sma50.length > 0) {
      const lastSMA50 = sma50[sma50.length - 1];
      const diff50 = ((currentPrice - lastSMA50) / lastSMA50 * 100).toFixed(2);
      maAnalysis.push(`SMA50: $${lastSMA50.toFixed(2)} (price ${Number(diff50) > 0 ? 'above' : 'below'} by ${Math.abs(Number(diff50))}%)`);
    }
    if (sma99.length > 0) {
      const lastSMA99 = sma99[sma99.length - 1];
      const diff99 = ((currentPrice - lastSMA99) / lastSMA99 * 100).toFixed(2);
      maAnalysis.push(`SMA99: $${lastSMA99.toFixed(2)} (price ${Number(diff99) > 0 ? 'above' : 'below'} by ${Math.abs(Number(diff99))}%)`);
    }
    if (sma200.length > 0) {
      const lastSMA200 = sma200[sma200.length - 1];
      const diff200 = ((currentPrice - lastSMA200) / lastSMA200 * 100).toFixed(2);
      maAnalysis.push(`SMA200: $${lastSMA200.toFixed(2)} (price ${Number(diff200) > 0 ? 'above' : 'below'} by ${Math.abs(Number(diff200))}%)`);
    }
    if (ema9.length > 0) {
      const lastEMA9 = ema9[ema9.length - 1];
      const diff9 = ((currentPrice - lastEMA9) / lastEMA9 * 100).toFixed(2);
      maAnalysis.push(`EMA9: $${lastEMA9.toFixed(2)} (price ${Number(diff9) > 0 ? 'above' : 'below'} by ${Math.abs(Number(diff9))}%)`);
    }
    if (ema21.length > 0) {
      const lastEMA21 = ema21[ema21.length - 1];
      const diff21 = ((currentPrice - lastEMA21) / lastEMA21 * 100).toFixed(2);
      maAnalysis.push(`EMA21: $${lastEMA21.toFixed(2)} (price ${Number(diff21) > 0 ? 'above' : 'below'} by ${Math.abs(Number(diff21))}%)`);
    }
    if (ema50.length > 0) {
      const lastEMA50 = ema50[ema50.length - 1];
      const diff50 = ((currentPrice - lastEMA50) / lastEMA50 * 100).toFixed(2);
      maAnalysis.push(`EMA50: $${lastEMA50.toFixed(2)} (price ${Number(diff50) > 0 ? 'above' : 'below'} by ${Math.abs(Number(diff50))}%)`);
    }
    if (ema100.length > 0) {
      const lastEMA100 = ema100[ema100.length - 1];
      const diff100 = ((currentPrice - lastEMA100) / lastEMA100 * 100).toFixed(2);
      maAnalysis.push(`EMA100: $${lastEMA100.toFixed(2)} (price ${Number(diff100) > 0 ? 'above' : 'below'} by ${Math.abs(Number(diff100))}%)`);
    }
    if (ema200.length > 0) {
      const lastEMA200 = ema200[ema200.length - 1];
      const diff200 = ((currentPrice - lastEMA200) / lastEMA200 * 100).toFixed(2);
      maAnalysis.push(`EMA200: $${lastEMA200.toFixed(2)} (price ${Number(diff200) > 0 ? 'above' : 'below'} by ${Math.abs(Number(diff200))}%)`);
    }
    
    // Price range analysis
    const highestHigh = Math.max(...candles.map(c => c.high));
    const lowestLow = Math.min(...candles.map(c => c.low));
    const priceRange = highestHigh - lowestLow;
    const positionInRange = ((currentPrice - lowestLow) / priceRange * 100).toFixed(1);
    
    // Volume analysis
    const avgVolume = candles.reduce((acc, c) => acc + c.volume, 0) / candles.length;
    const recentVolume = candles.slice(-5).reduce((acc, c) => acc + c.volume, 0) / 5;
    const volumeTrend = recentVolume > avgVolume * 1.2 ? 'INCREASING' : recentVolume < avgVolume * 0.8 ? 'DECREASING' : 'NORMAL';
    
    technicalData = `
TECHNICAL ANALYSIS (Pre-calculated):
────────────────────────────────────
TREND: ${trend}
Total candles analyzed: ${candles.length}

MOVING AVERAGES:
${maAnalysis.join('\n')}

KEY LEVELS (Calculados analisando TODOS os ${candles.length} candles do gráfico):
- Resistências identificadas: ${resistances.map(r => '$' + r.toFixed(2)).join(', ') || 'None identified'}
- Suportes identificados: ${supports.map(s => '$' + s.toFixed(2)).join(', ') || 'None identified'}
${volumeDescription ? `- Zonas de alto volume (suporte de volume): ${volumeHighZones.map(z => '$' + z.toFixed(2)).join(', ')}` : ''}
IMPORTANTE: Estes níveis foram calculados analisando o gráfico completo, não apenas os últimos candles. Zonas de alto volume indicam níveis onde pode haver pressão de compra/venda.

PRICE POSITION:
- Range: $${lowestLow.toFixed(2)} - $${highestHigh.toFixed(2)}
- Current position in range: ${positionInRange}%
- Distance from high: ${((highestHigh - currentPrice) / currentPrice * 100).toFixed(2)}%
- Distance from low: ${((currentPrice - lowestLow) / currentPrice * 100).toFixed(2)}%

VOLUME:
- Trend: ${volumeTrend}
- Recent vs Average: ${((recentVolume / avgVolume) * 100).toFixed(0)}%
`;
  }

  const systemPrompt = `Você é um trader profissional de criptomoedas e analista de mercado com mais de 15 anos de experiência. Você fala de forma direta e concisa como um trader experiente em uma mesa de operações, NÃO como um professor ou educador.

GUIA DE ESTILO:
- Seja direto e objetivo
- Use jargão de trader naturalmente
- Dê observações acionáveis, não palestras
- Pule explicações básicas - assuma que o usuário conhece trading
- Formato: Parágrafos curtos, bullet points quando relevante
- SEM emoji, SEM disclaimers excessivos
- Se ver algo significativo, diga claramente

DADOS DO MERCADO ATUAL:
Símbolo: ${chartContext?.symbol || 'BTCUSDT'}
Timeframe: ${chartContext?.timeframe || '1h'}
Preço: $${currentPrice.toLocaleString()}
24h: ${chartContext?.priceChange24h?.toFixed(2) || 'N/A'}%
${technicalData}

ÚLTIMOS 5 CANDLES (mais recente primeiro):
${candles.slice(-5).reverse().map((c, i) => 
  `${i + 1}. O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume.toFixed(0)}`
).join('\n')}

Ao analisar:
1. Observe as MAs pré-calculadas e identifique quais o preço está respeitando
2. **USE OS NÍVEIS DE SUPORTE/RESISTÊNCIA JÁ CALCULADOS** acima - eles foram identificados analisando TODO o gráfico (${candles.length} candles)
3. Avalie momentum baseado nos candles recentes e volume
4. Dê um viés direcional claro com raciocínio
5. **SEMPRE cite os níveis exatos que foram pré-calculados** (copie os valores exatos de Resistências/Suportes acima)

OBRIGATÓRIO - FORMATO DE RESPOSTA:
Sua resposta DEVE incluir SEMPRE:
- NO MÍNIMO 2 médias móveis específicas (ex: "SMA20", "EMA50", "SMA200") mencionadas claramente
- NO MÍNIMO 1 nível de resistência com valor exato (ex: "Resistência: $45,230.50")
- NO MÍNIMO 1 nível de suporte com valor exato (ex: "Suporte: $42,100.00")

Formato obrigatório para níveis:
- Use "Resistência:" ou "Resistências:" seguido dos valores com cifrão
- Use "Suporte:" ou "Suportes:" seguido dos valores com cifrão
- Valores devem ter 2 casas decimais (ex: $123456.78)

Exemplo de resposta válida:
"Preço testando SMA50 e EMA21. Resistências: $45,230.50, $46,100.00. Suporte: $42,500.00 como piso importante."

IMPORTANTE SOBRE TIMEFRAMES:
- Você SOMENTE pode analisar o timeframe atualmente exibido: ${chartContext?.timeframe || '1h'}
- Se o usuário pedir para analisar um timeframe diferente (tipo "analise 1d" quando o atual é 1h), diga: "Para analisar o timeframe de [X], primeiro mude o seletor de timeframe no topo da tela para [X], depois peça a análise novamente."
- Nunca especule ou invente análise para timeframes que você não tem dados

Finalize SEMPRE com uma linha: "Isso não é recomendação financeira."

CRÍTICO: Você DEVE responder EXCLUSIVAMENTE em português brasileiro. TODAS as suas respostas, análises, observações e comentários devem ser 100% em português. NUNCA use inglês.`;

  // Convert messages to Gemini format
  const geminiMessages = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: typeof (msg as any).content === 'string' ? (msg as any).content : JSON.stringify((msg as any).content) }],
  }));

  // Add system prompt as first user message if not empty
  if (systemPrompt) {
    geminiMessages.unshift({
      role: 'user',
      parts: [{ text: `System Instructions: ${systemPrompt}` }],
    });
    geminiMessages.splice(1, 0, {
      role: 'model', 
      parts: [{ text: 'Entendido. Vou seguir estas instruções e ajudar a analisar o gráfico em português brasileiro.' }],
    });
  }

  try {
    
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Gemini API error: ${response.status}` }), { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Transform Gemini SSE stream to AI SDK format
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk);
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (content) {
                // Format as AI SDK UI message stream
                const uiMessage = {
                  type: 'text-delta',
                  textDelta: content,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(uiMessage)}\n\n`));
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      },
      flush(controller) {
        // Send finish message
        controller.enqueue(encoder.encode(`data: {"type":"finish","finishReason":"stop"}\n\n`));
      }
    });

    const stream = response.body?.pipeThrough(transformStream);
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
