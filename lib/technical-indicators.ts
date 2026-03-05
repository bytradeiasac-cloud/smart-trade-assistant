// Technical Indicators Library
export interface Candle {
  timestamp?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// RSI - Relative Strength Index
export function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
      continue;
    }
    
    let gains = 0;
    let losses = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      const change = closes[j] - closes[j - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) {
      result.push(avgGain === 0 ? 50 : 100);
    } else {
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    }
  }
  
  return result;
}

// MACD - Moving Average Convergence Divergence
export function calculateMACD(closes: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const ema12 = calculateEMAForIndicator(closes, fastPeriod);
  const ema26 = calculateEMAForIndicator(closes, slowPeriod);
  
  const macd: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] === null || ema26[i] === null) {
      macd.push(null);
    } else {
      macd.push(ema12[i]! - ema26[i]!);
    }
  }
  
  const signal = calculateEMAForIndicator(macd.map(v => v ?? 0), signalPeriod);
  const histogram: (number | null)[] = [];
  
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null || signal[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macd[i]! - signal[i]!);
    }
  }
  
  return { macd, signal, histogram };
}

// Stochastic Oscillator
export function calculateStochastic(candles: Candle[], period = 14, smoothK = 3, smoothD = 3) {
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  
  const kValues: (number | null)[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      kValues.push(null);
      continue;
    }
    
    const high = Math.max(...highs.slice(i - period + 1, i + 1));
    const low = Math.min(...lows.slice(i - period + 1, i + 1));
    
    const k = high === low ? 50 : ((closes[i] - low) / (high - low)) * 100;
    kValues.push(k);
  }
  
  const k = calculateSMA(kValues.map(v => v ?? 0), smoothK);
  const d = calculateSMA(k.map(v => v ?? 0), smoothD);
  
  return { k, d };
}

// ATR - Average True Range
export function calculateATR(candles: Candle[], period = 14) {
  const trueRanges: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trueRanges.push(candles[i].high - candles[i].low);
    } else {
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
      trueRanges.push(tr);
    }
  }
  
  const atr: (number | null)[] = [];
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      atr.push(null);
    } else if (i === period - 1) {
      const sum = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
      atr.push(sum / period);
    } else {
      const prevATR = atr[i - 1]!;
      atr.push((prevATR * (period - 1) + trueRanges[i]) / period);
    }
  }
  
  return atr;
}

// ADX - Average Directional Index
export function calculateADX(candles: Candle[], period = 14) {
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low);
      plusDM.push(0);
      minusDM.push(0);
    } else {
      const trValue = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
      tr.push(trValue);
      
      const upMove = candles[i].high - candles[i - 1].high;
      const downMove = candles[i - 1].low - candles[i].low;
      
      if (upMove > downMove && upMove > 0) {
        plusDM.push(upMove);
        minusDM.push(0);
      } else if (downMove > upMove && downMove > 0) {
        plusDM.push(0);
        minusDM.push(downMove);
      } else {
        plusDM.push(0);
        minusDM.push(0);
      }
    }
  }
  
  const adx: (number | null)[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      adx.push(null);
    } else {
      const sumTR = tr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      const sumPlusDM = plusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      const sumMinusDM = minusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      
      const plusDI = (sumPlusDM / sumTR) * 100;
      const minusDI = (sumMinusDM / sumTR) * 100;
      
      const di = Math.abs(plusDI - minusDI) / (plusDI + minusDI);
      adx.push(di * 100);
    }
  }
  
  return adx;
}

// OBV - On Balance Volume
export function calculateOBV(candles: Candle[]) {
  const obv: number[] = [];
  let cumulative = 0;
  
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      cumulative = candles[i].volume;
    } else {
      if (candles[i].close > candles[i - 1].close) {
        cumulative += candles[i].volume;
      } else if (candles[i].close < candles[i - 1].close) {
        cumulative -= candles[i].volume;
      }
    }
    obv.push(cumulative);
  }
  
  return obv;
}

// CCI - Commodity Channel Index
export function calculateCCI(candles: Candle[], period = 20) {
  const typicalPrices = candles.map(c => (c.high + c.low + c.close) / 3);
  const cci: (number | null)[] = [];
  
  for (let i = 0; i < typicalPrices.length; i++) {
    if (i < period - 1) {
      cci.push(null);
    } else {
      const window = typicalPrices.slice(i - period + 1, i + 1);
      const sma = window.reduce((a, b) => a + b, 0) / period;
      const deviation = window.map(p => Math.abs(p - sma)).reduce((a, b) => a + b, 0) / period;
      const cciValue = deviation === 0 ? 0 : (typicalPrices[i] - sma) / (0.015 * deviation);
      cci.push(cciValue);
    }
  }
  
  return cci;
}

// Ichimoku Cloud
export function calculateIchimoku(candles: Candle[]) {
  const tenkan: (number | null)[] = [];
  const kijun: (number | null)[] = [];
  const senkouA: (number | null)[] = [];
  const senkouB: (number | null)[] = [];
  const chikou: (number | null)[] = [];
  
  // Tenkan (9 periods)
  for (let i = 0; i < candles.length; i++) {
    if (i < 9 - 1) {
      tenkan.push(null);
    } else {
      const highs = candles.slice(i - 8, i + 1).map(c => c.high);
      const lows = candles.slice(i - 8, i + 1).map(c => c.low);
      tenkan.push((Math.max(...highs) + Math.min(...lows)) / 2);
    }
  }
  
  // Kijun (26 periods)
  for (let i = 0; i < candles.length; i++) {
    if (i < 26 - 1) {
      kijun.push(null);
    } else {
      const highs = candles.slice(i - 25, i + 1).map(c => c.high);
      const lows = candles.slice(i - 25, i + 1).map(c => c.low);
      kijun.push((Math.max(...highs) + Math.min(...lows)) / 2);
    }
  }
  
  // Senkou A (shifted 26 periods ahead)
  for (let i = 0; i < candles.length; i++) {
    if (i + 26 >= candles.length || tenkan[i] === null || kijun[i] === null) {
      senkouA.push(null);
    } else {
      senkouA.push((tenkan[i]! + kijun[i]!) / 2);
    }
  }
  
  // Senkou B (52 periods, shifted 26 ahead)
  for (let i = 0; i < candles.length; i++) {
    if (i < 52 - 1 || i + 26 >= candles.length) {
      senkouB.push(null);
    } else {
      const highs = candles.slice(i - 51, i + 1).map(c => c.high);
      const lows = candles.slice(i - 51, i + 1).map(c => c.low);
      senkouB.push((Math.max(...highs) + Math.min(...lows)) / 2);
    }
  }
  
  // Chikou (26 periods lagged)
  for (let i = 0; i < candles.length; i++) {
    if (i - 26 < 0) {
      chikou.push(null);
    } else {
      chikou.push(candles[i - 26].close);
    }
  }
  
  return { tenkan, kijun, senkouA, senkouB, chikou };
}

// SAR - Parabolic SAR
export function calculateSAR(candles: Candle[], af = 0.02, maxAF = 0.2) {
  const sar: number[] = [];
  const trend: number[] = [];
  
  let isUptrend = true;
  let ep = candles[0].high;
  let sarValue = candles[0].low;
  let afValue = af;
  
  for (let i = 0; i < candles.length; i++) {
    if (isUptrend) {
      sarValue = sarValue + afValue * (ep - sarValue);
      sarValue = Math.min(sarValue, candles[i - 1]?.low || candles[i].low, candles[i - 2]?.low || candles[i].low);
      
      if (candles[i].high > ep) {
        ep = candles[i].high;
        afValue = Math.min(afValue + af, maxAF);
      }
      
      if (candles[i].low < sarValue) {
        isUptrend = false;
        sarValue = ep;
        ep = candles[i].low;
        afValue = af;
      }
    } else {
      sarValue = sarValue + afValue * (ep - sarValue);
      sarValue = Math.max(sarValue, candles[i - 1]?.high || candles[i].high, candles[i - 2]?.high || candles[i].high);
      
      if (candles[i].low < ep) {
        ep = candles[i].low;
        afValue = Math.min(afValue + af, maxAF);
      }
      
      if (candles[i].high > sarValue) {
        isUptrend = true;
        sarValue = ep;
        ep = candles[i].high;
        afValue = af;
      }
    }
    
    sar.push(sarValue);
    trend.push(isUptrend ? 1 : -1);
  }
  
  return { sar, trend };
}

// Helper functions
export function calculateEMA(values: (number | null)[], period: number): (number | null)[] {
  return calculateEMAForIndicator(values, period);
}

export function calculateEMAForIndicator(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < values.length; i++) {
    if (values[i] === null) {
      result.push(null);
      continue;
    }
    
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const sum = values.slice(0, period).reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
      result.push((sum as number) / period);
    } else {
      const prevEma = result[i - 1];
      if (prevEma !== null) {
        const ema = (values[i]! - prevEma) * multiplier + prevEma;
        result.push(ema);
      } else {
        result.push(null);
      }
    }
  }
  
  return result;
}

function calculateSMA(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const window = values.slice(i - period + 1, i + 1).filter(v => v !== null) as number[];
      if (window.length === period) {
        result.push(window.reduce((a, b) => a + b, 0) / period);
      } else {
        result.push(null);
      }
    }
  }
  
  return result;
}
