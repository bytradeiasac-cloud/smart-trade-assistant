'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  LineData,
  HistogramData,
  Time,
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts';
import {
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  calculateATR,
  calculateADX,
  calculateOBV,
  calculateCCI,
  calculateIchimoku,
  calculateSAR,
  Candle,
} from '@/lib/technical-indicators';

interface IndicatorPanelsProps {
  data: any[];
  visible?: {
    rsi?: boolean;
    macd?: boolean;
    stochastic?: boolean;
    atr?: boolean;
    adx?: boolean;
    obv?: boolean;
    cci?: boolean;
    ichimoku?: boolean;
    sar?: boolean;
  };
}

export default function IndicatorPanels({ data = [], visible = {} }: IndicatorPanelsProps) {
  // Debug: Log incoming data format
  console.log('[v0] IndicatorPanels - data sample:', data.length > 0 ? data[0] : 'no data');
  console.log('[v0] IndicatorPanels - data length:', data.length);
  console.log('[v0] IndicatorPanels - visible panels:', visible);

  // Convert KlineData to Candle format - KlineData has 'timestamp' not 'time'
  const candles: (Candle & { timestamp: number })[] = (data || []).map((d: any) => ({
    timestamp: d.timestamp as number,
    open: typeof d.open === 'number' ? d.open : parseFloat(d.open),
    high: typeof d.high === 'number' ? d.high : parseFloat(d.high),
    low: typeof d.low === 'number' ? d.low : parseFloat(d.low),
    close: typeof d.close === 'number' ? d.close : parseFloat(d.close),
    volume: typeof d.volume === 'number' ? d.volume : parseFloat(d.volume),
  }));

  console.log('[v0] IndicatorPanels - candles sample:', candles.length > 0 ? candles[0] : 'no candles');
  console.log('[v0] IndicatorPanels - timestamp format check:', candles.length > 0 ? {
    raw: candles[0].timestamp,
    divided: candles[0].timestamp / 1000,
    asDate: new Date(candles[0].timestamp),
  } : 'no data');

  const containersRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const chartsRef = useRef<{ [key: string]: IChartApi | null }>({});

  // RSI
  useEffect(() => {
    console.log('[v0] RSI useEffect triggered - visible:', visible.rsi, 'container:', !!containersRef.current.rsi, 'candles:', candles.length);
    
    if (!visible.rsi || !containersRef.current.rsi || !candles || candles.length === 0) return;

    // Cleanup previous chart
    if (chartsRef.current.rsi) {
      chartsRef.current.rsi.remove();
      chartsRef.current.rsi = null;
    }

    try {
      const chart = createChart(containersRef.current.rsi, {
        width: containersRef.current.rsi.clientWidth,
        height: 160,
        layout: {
          background: { color: 'transparent' },
          textColor: '#d1d5db',
        },
        timeScale: { timeVisible: false, secondsVisible: false },
      });

      const rsiValues = calculateRSI(candles.map(c => c.close), 14);
      console.log('[v0] RSI calculated values sample:', rsiValues.slice(0, 5));
      
      const series = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2 });

      // Filter out null values and create proper time format
      const chartData: LineData[] = [];
      for (let i = 0; i < candles.length; i++) {
        const value = rsiValues[i];
        if (value !== null && value !== undefined && isFinite(value)) {
          const timeValue = Math.floor(candles[i].timestamp / 1000);
          chartData.push({
            time: timeValue as Time,
            value: value,
          });
        }
      }
      
      console.log('[v0] RSI chartData sample:', chartData.slice(0, 3));
      console.log('[v0] RSI chartData length:', chartData.length);

      series.setData(chartData);
      chart.timeScale().fitContent();
      chartsRef.current.rsi = chart;

      const handleResize = () => {
        if (containersRef.current.rsi) {
          chart.applyOptions({ width: containersRef.current.rsi.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    } catch (err) {
      console.log('[v0] Erro ao renderizar RSI:', err);
    }
  }, [candles, visible.rsi]);

  // MACD
  useEffect(() => {
    console.log('[v0] MACD useEffect triggered - visible:', visible.macd, 'container:', !!containersRef.current.macd, 'candles:', candles.length);
    
    if (!visible.macd || !containersRef.current.macd || !candles || candles.length === 0) return;

    // Cleanup previous chart
    if (chartsRef.current.macd) {
      chartsRef.current.macd.remove();
      chartsRef.current.macd = null;
    }

    try {
      const chart = createChart(containersRef.current.macd, {
        width: containersRef.current.macd.clientWidth,
        height: 160,
        layout: { background: { color: 'transparent' }, textColor: '#d1d5db' },
        timeScale: { timeVisible: false, secondsVisible: false },
      });

      const { macd, signal } = calculateMACD(candles.map(c => c.close));
      console.log('[v0] MACD calculated values sample:', { macd: macd.slice(0, 5), signal: signal.slice(0, 5) });

      const macdSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2 });
      const signalSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2 });

      // Build MACD data with proper time format
      const macdData: LineData[] = [];
      const signalData: LineData[] = [];
      
      for (let i = 0; i < candles.length; i++) {
        const timeValue = Math.floor(candles[i].timestamp / 1000);
        const macdValue = macd[i];
        const signalValue = signal[i];
        
        if (macdValue !== null && macdValue !== undefined && isFinite(macdValue)) {
          macdData.push({ time: timeValue as Time, value: macdValue });
        }
        if (signalValue !== null && signalValue !== undefined && isFinite(signalValue)) {
          signalData.push({ time: timeValue as Time, value: signalValue });
        }
      }

      console.log('[v0] MACD chartData sample:', macdData.slice(0, 3));
      console.log('[v0] MACD chartData length:', macdData.length, 'signal length:', signalData.length);

      macdSeries.setData(macdData);
      signalSeries.setData(signalData);
      chart.timeScale().fitContent();
      chartsRef.current.macd = chart;

      const handleResize = () => {
        if (containersRef.current.macd) {
          chart.applyOptions({ width: containersRef.current.macd.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    } catch (err) {
      console.log('[v0] Erro ao renderizar MACD:', err);
    }
  }, [candles, visible.macd]);

  // Stochastic
  useEffect(() => {
    if (!visible.stochastic || !containersRef.current.stochastic || !candles || candles.length === 0) return;

    try {
      const chart = createChart(containersRef.current.stochastic, {
        width: containersRef.current.stochastic.clientWidth,
        height: 160,
        layout: { background: { color: 'transparent' }, textColor: '#d1d5db' },
        timeScale: { timeVisible: false, secondsVisible: false },
      });

      const { k, d } = calculateStochastic(candles, 14, 3, 3);
      
      const kSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2 });
      const dSeries = chart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 2 });

      const kData: LineData[] = [];
      const dData: LineData[] = [];
      
      for (let i = 0; i < candles.length; i++) {
        const timeValue = Math.floor(candles[i].timestamp / 1000);
        const kValue = k[i];
        const dValue = d[i];
        
        if (kValue !== null && kValue !== undefined && isFinite(kValue)) {
          kData.push({ time: timeValue as Time, value: kValue });
        }
        if (dValue !== null && dValue !== undefined && isFinite(dValue)) {
          dData.push({ time: timeValue as Time, value: dValue });
        }
      }

      kSeries.setData(kData);
      dSeries.setData(dData);
      chart.timeScale().fitContent();
      chartsRef.current.stochastic = chart;

      const handleResize = () => {
        if (containersRef.current.stochastic) {
          chart.applyOptions({ width: containersRef.current.stochastic.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    } catch (err) {
      console.log('[v0] Erro ao renderizar Stochastic:', err);
    }
  }, [candles, visible.stochastic]);

  // ATR
  useEffect(() => {
    if (!visible.atr || !containersRef.current.atr || !candles || candles.length === 0) return;

    try {
      const chart = createChart(containersRef.current.atr, {
        width: containersRef.current.atr.clientWidth,
        height: 160,
        layout: { background: { color: 'transparent' }, textColor: '#d1d5db' },
        timeScale: { timeVisible: false, secondsVisible: false },
      });

      const atr = calculateATR(candles, 14);
      const series = chart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 2 });

      const data: LineData[] = candles
        .map((c, i) => ({ time: (c.timestamp / 1000) as Time, value: atr[i] ?? 0 }))
        .filter((_, i) => atr[i] !== null);

      series.setData(data);
      chart.timeScale().fitContent();
      chartsRef.current.atr = chart;

      const handleResize = () => {
        if (containersRef.current.atr) {
          chart.applyOptions({ width: containersRef.current.atr.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    } catch (err) {
      console.log('[v0] Erro ao renderizar ATR:', err);
    }
  }, [candles, visible.atr]);

  // OBV
  useEffect(() => {
    if (!visible.obv || !containersRef.current.obv || !candles || candles.length === 0) return;

    try {
      const chart = createChart(containersRef.current.obv, {
        width: containersRef.current.obv.clientWidth,
        height: 160,
        layout: { background: { color: 'transparent' }, textColor: '#d1d5db' },
        timeScale: { timeVisible: false, secondsVisible: false },
      });

      const obv = calculateOBV(candles);
      const series = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 2 });

      const data: LineData[] = candles
        .map((c, i) => ({ time: (c.timestamp / 1000) as Time, value: obv[i] ?? 0 }))
        .filter((_, i) => obv[i] !== null);

      series.setData(data);
      chart.timeScale().fitContent();
      chartsRef.current.obv = chart;

      const handleResize = () => {
        if (containersRef.current.obv) {
          chart.applyOptions({ width: containersRef.current.obv.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    } catch (err) {
      console.log('[v0] Erro ao renderizar OBV:', err);
    }
  }, [candles, visible.obv]);

  return (
    <div className="flex flex-col gap-4 p-3 bg-card">
      {visible.rsi && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">RSI (14)</span>
          <div ref={el => { containersRef.current.rsi = el; }} className="w-full h-40 rounded border border-border bg-background" />
        </div>
      )}

      {visible.macd && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">MACD</span>
          <div ref={el => { containersRef.current.macd = el; }} className="w-full h-40 rounded border border-border bg-background" />
        </div>
      )}

      {visible.stochastic && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">Stochastic</span>
          <div ref={el => { containersRef.current.stochastic = el; }} className="w-full h-40 rounded border border-border bg-background" />
        </div>
      )}

      {visible.atr && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">ATR (14)</span>
          <div ref={el => { containersRef.current.atr = el; }} className="w-full h-40 rounded border border-border bg-background" />
        </div>
      )}

      {visible.adx && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">ADX (14)</span>
          <div ref={el => { containersRef.current.adx = el; }} className="w-full h-40 rounded border border-border bg-background" />
        </div>
      )}

      {visible.obv && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">OBV</span>
          <div ref={el => { containersRef.current.obv = el; }} className="w-full h-40 rounded border border-border bg-background" />
        </div>
      )}

      {visible.cci && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">CCI (20)</span>
          <div ref={el => { containersRef.current.cci = el; }} className="w-full h-40 rounded border border-border bg-background" />
        </div>
      )}

      {visible.ichimoku && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">Ichimoku</span>
          <div ref={el => { containersRef.current.ichimoku = el; }} className="w-full h-40 rounded border border-border bg-background" />
        </div>
      )}

      {visible.sar && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">SAR</span>
          <div ref={el => { containersRef.current.sar = el; }} className="w-full h-40 rounded border border-border bg-background" />
        </div>
      )}
    </div>
  );
}
