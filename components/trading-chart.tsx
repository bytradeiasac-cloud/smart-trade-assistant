'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts';
import { KlineData, calculateSMA, calculateEMA, calculateBollingerBands } from '@/lib/bybit';

export interface Indicator {
  type: 'SMA' | 'EMA' | 'BB';
  period: number;
  color: string;
  visible: boolean;
}

export interface PriceLine {
  price: number;
  color: string;
  label: string;
}

export interface ChartMarker {
  time: number; // timestamp em segundos
  position: 'aboveBar' | 'belowBar';
  color: string;
  text: string; // ↑ ou ↓
}

interface TradingChartProps {
  data: KlineData[];
  symbol: string;
  indicators?: Indicator[];
  priceLines?: PriceLine[];
  markers?: ChartMarker[];
}

export default function TradingChart({ data, symbol, indicators = [], priceLines = [], markers = [] }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<CandlestickSeries> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<LineSeries>>>(new Map());
  const priceLinesRef = useRef<Map<string, any>>(new Map());
  const buySignalSeriesRef = useRef<ISeriesApi<LineSeries> | null>(null);
  const sellSignalSeriesRef = useRef<ISeriesApi<LineSeries> | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);

  // Convert data to chart format
  const formatChartData = useCallback((klineData: KlineData[]): CandlestickData[] => {
    return klineData.map((item) => ({
      time: (item.timestamp / 1000) as Time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#12161c' },
        textColor: '#848e9c',
      },
      grid: {
        vertLines: { color: '#1e2329' },
        horzLines: { color: '#1e2329' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#f7a600',
          width: 1,
          style: 2,
          labelBackgroundColor: '#f7a600',
        },
        horzLine: {
          color: '#f7a600',
          width: 1,
          style: 2,
          labelBackgroundColor: '#f7a600',
        },
      },
      rightPriceScale: {
        borderColor: '#2b3139',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#2b3139',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderVisible: false,
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
    });

    // Series para sinais de compra (pontos azul ciano)
    const buySignalSeries = chart.addSeries(LineSeries, {
      color: 'transparent',
      lineWidth: 0,
      lineVisible: false,
      pointMarkersVisible: true,
      pointMarkersRadius: 5,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    buySignalSeries.applyOptions({
      color: '#22d3ee',
    });

    // Series para sinais de venda (pontos laranja)
    const sellSignalSeries = chart.addSeries(LineSeries, {
      color: 'transparent',
      lineWidth: 0,
      lineVisible: false,
      pointMarkersVisible: true,
      pointMarkersRadius: 5,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    sellSignalSeries.applyOptions({
      color: '#fb923c',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    buySignalSeriesRef.current = buySignalSeries;
    sellSignalSeriesRef.current = sellSignalSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      indicatorSeriesRef.current.clear();
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!candlestickSeriesRef.current || data.length === 0) return;

    const chartData = formatChartData(data);
    candlestickSeriesRef.current.setData(chartData);



    // Update current price
    const lastCandle = data[data.length - 1];
    const firstCandle = data[0];
    if (lastCandle) {
      setCurrentPrice(lastCandle.close);
      setPriceChange(((lastCandle.close - firstCandle.close) / firstCandle.close) * 100);
    }
  }, [data, formatChartData]);

  // Update markers (sinais de compra/venda) como pontos discretos
  useEffect(() => {
    if (!buySignalSeriesRef.current || !sellSignalSeriesRef.current) return;
    
    if (markers.length > 0 && data.length > 0) {
      const buySignals: { time: Time; value: number }[] = [];
      const sellSignals: { time: Time; value: number }[] = [];
      
      markers.forEach((marker) => {
        const candle = data.find(d => Math.floor(d.timestamp / 1000) === marker.time);
        if (candle && candle.close && candle.low && candle.high) {
          // Calcula offset baseado na altura do candle (aproximadamente 0.3% do preço)
          const offset = candle.close * 0.003;
          
          const value = marker.position === 'belowBar' 
            ? candle.low - offset  // Compra: abaixo do candle
            : candle.high + offset; // Venda: acima do candle
          
          // Valida que o valor não é null, undefined, NaN ou Infinity
          if (value && isFinite(value)) {
            const point = {
              time: (candle.timestamp / 1000) as Time,
              value,
            };
            
            if (marker.position === 'belowBar') {
              buySignals.push(point);
            } else {
              sellSignals.push(point);
            }
          }
        }
      });
      
      buySignalSeriesRef.current.setData(buySignals);
      sellSignalSeriesRef.current.setData(sellSignals);
    } else {
      buySignalSeriesRef.current.setData([]);
      sellSignalSeriesRef.current.setData([]);
    }
  }, [markers, data]);

  // Update indicators
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    const closePrices = data.map((d) => d.close);
    const times = data.map((d) => (d.timestamp / 1000) as Time);

    // Remove old indicators that are no longer needed
    indicatorSeriesRef.current.forEach((series, key) => {
      const indicator = indicators.find((i) => `${i.type}-${i.period}` === key);
      if (!indicator || !indicator.visible) {
        chartRef.current?.removeSeries(series);
        indicatorSeriesRef.current.delete(key);
      }
    });

    // Add or update indicators
    indicators.forEach((indicator) => {
      if (!indicator.visible) return;

      const key = `${indicator.type}-${indicator.period}`;
      let series = indicatorSeriesRef.current.get(key);

      if (!series) {
        series = chartRef.current!.addSeries(LineSeries, {
          color: indicator.color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        indicatorSeriesRef.current.set(key, series);
      }

      let values: (number | null)[] = [];

      switch (indicator.type) {
        case 'SMA':
          values = calculateSMA(closePrices, indicator.period);
          break;
        case 'EMA':
          values = calculateEMA(closePrices, indicator.period);
          break;
        case 'BB':
          const bb = calculateBollingerBands(closePrices, indicator.period);
          // For BB, we show the middle band
          values = bb.middle;
          
          // Add upper and lower bands
          const upperKey = `${key}-upper`;
          const lowerKey = `${key}-lower`;
          
          let upperSeries = indicatorSeriesRef.current.get(upperKey);
          let lowerSeries = indicatorSeriesRef.current.get(lowerKey);
          
          if (!upperSeries) {
            upperSeries = chartRef.current!.addSeries(LineSeries, {
              color: indicator.color,
              lineWidth: 1,
              lineStyle: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            });
            indicatorSeriesRef.current.set(upperKey, upperSeries);
          }
          
          if (!lowerSeries) {
            lowerSeries = chartRef.current!.addSeries(LineSeries, {
              color: indicator.color,
              lineWidth: 1,
              lineStyle: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            });
            indicatorSeriesRef.current.set(lowerKey, lowerSeries);
          }
          
          const upperData: LineData[] = bb.upper
            .map((value, i) => (value !== null ? { time: times[i], value } : null))
            .filter((d): d is LineData => d !== null);
          
          const lowerData: LineData[] = bb.lower
            .map((value, i) => (value !== null ? { time: times[i], value } : null))
            .filter((d): d is LineData => d !== null);
          
          upperSeries.setData(upperData);
          lowerSeries.setData(lowerData);
          break;
      }

      const lineData: LineData[] = values
        .map((value, i) => (value !== null ? { time: times[i], value } : null))
        .filter((d): d is LineData => d !== null);

      series.setData(lineData);
    });
  }, [data, indicators]);

  // Update price lines usando LineSeries horizontal
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    const times = data.map((d) => (d.timestamp / 1000) as Time);

    // Remove old price lines
    priceLinesRef.current.forEach((series, key) => {
      const exists = priceLines.find(pl => `${pl.price}-${pl.label}` === key);
      if (!exists) {
        chartRef.current?.removeSeries(series);
        priceLinesRef.current.delete(key);
      }
    });

    // Add new price lines como LineSeries horizontal
    priceLines.forEach((priceLine) => {
      const key = `${priceLine.price}-${priceLine.label}`;
      if (!priceLinesRef.current.has(key)) {
        const series = chartRef.current!.addSeries(LineSeries, {
          color: priceLine.color,
          lineWidth: 2,
          lineStyle: 2, // dashed
          priceLineVisible: true,
          lastValueVisible: true,
          title: priceLine.label,
        });
        
        // Cria linha horizontal no preço especificado
        const lineData: LineData[] = times.map((time) => ({
          time,
          value: priceLine.price,
        }));
        
        series.setData(lineData);
        priceLinesRef.current.set(key, series);
      }
    });
  }, [priceLines, data]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={chartContainerRef} className="w-full h-full" />
      {/* Markers overlay - sinais de compra/venda */}
      {markers.length > 0 && (
        <div className="absolute top-2 right-2 bg-background/80 border border-border rounded-lg p-2 z-10 max-h-32 overflow-y-auto">
          <p className="text-xs font-semibold mb-1">Sinais:</p>
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-cyan-400">Compra: {markers.filter(m => m.position === 'belowBar').length}</span>
            <span className="text-xs text-orange-400">Venda: {markers.filter(m => m.position === 'aboveBar').length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
