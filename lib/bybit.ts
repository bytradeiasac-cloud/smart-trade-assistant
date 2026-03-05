// Using CryptoCompare API - works globally without geo-restrictions
// Free tier: 100,000 calls/month

const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com';

export interface KlineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerData {
  symbol: string;
  lastPrice: string;
  price24hPcnt: string;
  highPrice24h: string;
  lowPrice24h: string;
  volume24h: string;
  turnover24h: string;
}

export type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export const TIMEFRAME_LABELS: Record<TimeFrame, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1D',
  '1w': '1W',
};

export const TRADING_PAIRS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'DOTUSDT',
];

// Map our symbols to CryptoCompare format (BTC, ETH, etc.)
function parseSymbol(symbol: string): { base: string; quote: string } {
  // BTCUSDT -> BTC, USDT
  const quote = symbol.endsWith('USDT') ? 'USDT' : 'USD';
  const base = symbol.replace(/USDT$|USD$/, '');
  return { base, quote };
}

// CryptoCompare uses different endpoints based on timeframe
function getEndpointForTimeframe(timeframe: TimeFrame): { endpoint: string; aggregate: number } {
  switch (timeframe) {
    case '1m':
      return { endpoint: 'histominute', aggregate: 1 };
    case '5m':
      return { endpoint: 'histominute', aggregate: 5 };
    case '15m':
      return { endpoint: 'histominute', aggregate: 15 };
    case '1h':
      return { endpoint: 'histohour', aggregate: 1 };
    case '4h':
      return { endpoint: 'histohour', aggregate: 4 };
    case '1d':
      return { endpoint: 'histoday', aggregate: 1 };
    case '1w':
      return { endpoint: 'histoday', aggregate: 7 };
    default:
      return { endpoint: 'histohour', aggregate: 1 };
  }
}

export async function getKlineData(
  symbol: string,
  interval: TimeFrame,
  limit: number = 2000
): Promise<KlineData[]> {
  const { base, quote } = parseSymbol(symbol);
  const { endpoint, aggregate } = getEndpointForTimeframe(interval);
  
  const url = `${CRYPTOCOMPARE_API}/data/v2/${endpoint}?fsym=${base}&tsym=${quote}&limit=${limit}&aggregate=${aggregate}`;
  
  const response = await fetch(url, { 
    cache: 'no-store',
    headers: {
      'Accept': 'application/json',
    }
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[v0] CryptoCompare kline fetch failed:', text);
    throw new Error('Failed to fetch kline data');
  }

  const json = await response.json();
  
  if (json.Response === 'Error') {
    console.error('[v0] CryptoCompare API error:', json.Message);
    throw new Error(json.Message || 'Failed to fetch kline data');
  }

  const data = json.Data?.Data || [];
  
  return data.map((item: { time: number; open: number; high: number; low: number; close: number; volumefrom: number }) => ({
    timestamp: item.time * 1000, // Convert to milliseconds
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volumefrom,
  }));
}

export async function getTickers(symbols?: string[]): Promise<TickerData[]> {
  const targetSymbols = symbols || TRADING_PAIRS;
  const bases = targetSymbols.map(s => parseSymbol(s).base);
  
  // Get current prices
  const priceUrl = `${CRYPTOCOMPARE_API}/data/pricemultifull?fsyms=${bases.join(',')}&tsyms=USDT`;
  
  const response = await fetch(priceUrl, { 
    cache: 'no-store',
    headers: {
      'Accept': 'application/json',
    }
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[v0] CryptoCompare tickers fetch failed:', text);
    throw new Error('Failed to fetch tickers');
  }

  const json = await response.json();
  
  if (!json.RAW) {
    console.error('[v0] CryptoCompare API returned no data');
    return [];
  }

  const results: TickerData[] = [];
  
  for (const base of bases) {
    const data = json.RAW[base]?.USDT;
    if (data) {
      results.push({
        symbol: `${base}USDT`,
        lastPrice: data.PRICE?.toString() || '0',
        price24hPcnt: ((data.CHANGEPCT24HOUR || 0) / 100).toString(),
        highPrice24h: data.HIGH24HOUR?.toString() || '0',
        lowPrice24h: data.LOW24HOUR?.toString() || '0',
        volume24h: data.VOLUME24HOUR?.toString() || '0',
        turnover24h: data.VOLUME24HOURTO?.toString() || '0',
      });
    }
  }

  return results;
}

// Technical Indicators
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }

  return result;
}

export function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const sum = data.slice(0, period).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    } else {
      const prevEma = result[i - 1]!;
      const ema = (data[i] - prevEma) * multiplier + prevEma;
      result.push(ema);
    }
  }

  return result;
}

export function calculateRSI(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  result.push(null);

  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    } else {
      const prevRsi = result[i];
      if (prevRsi === null) {
        result.push(null);
        continue;
      }
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }

  return result;
}

export function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calculateSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(Math.max(0, i - period + 1), i + 1);
      const mean = middle[i]!;
      const squaredDiffs = slice.map((x) => Math.pow(x - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / slice.length;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }

  return { upper, middle, lower };
}
