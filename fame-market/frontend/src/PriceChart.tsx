import { useEffect, useRef } from 'react';
import {
  AreaSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type SeriesMarker,
  type UTCTimestamp
} from 'lightweight-charts';
import type { PricePoint, Trade } from './types';

interface PriceChartProps {
  data: PricePoint[];
  positive: boolean;
  trades?: Trade[];
}

export function PriceChart({ data, positive, trades = [] }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const accent = positive ? '#168f5c' : '#d94b43';
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#666660',
        attributionLogo: true
      },
      grid: {
        vertLines: { color: '#ecebe6' },
        horzLines: { color: '#ecebe6' }
      },
      rightPriceScale: {
        borderColor: '#d8d7d1'
      },
      timeScale: {
        borderColor: '#d8d7d1',
        timeVisible: true
      },
      crosshair: {
        vertLine: { color: '#7c7b75', labelBackgroundColor: '#111111' },
        horzLine: { color: '#7c7b75', labelBackgroundColor: '#111111' }
      }
    });
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: accent,
      topColor: positive ? 'rgba(22, 143, 92, 0.22)' : 'rgba(217, 75, 67, 0.20)',
      bottomColor: 'rgba(255, 255, 255, 0)',
      lineWidth: 3,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
    });
    series.setData(
      data.map((point) => ({ time: point.time as UTCTimestamp, value: point.value }))
    );
    const markers: SeriesMarker<UTCTimestamp>[] = trades
      .map((trade): SeriesMarker<UTCTimestamp> => ({
        time: Math.floor(
          new Date(trade.createdAt).getTime() / 1000
        ) as UTCTimestamp,
        position: trade.side === 'buy' ? 'belowBar' : 'aboveBar',
        color: trade.side === 'buy' ? '#168f5c' : '#d94b43',
        shape: trade.side === 'buy' ? 'arrowUp' : 'arrowDown',
        text: `${trade.side === 'buy' ? 'Compra' : 'Venta'} ${trade.quantity}`,
        size: 1
      }))
      .sort((a, b) => Number(a.time) - Number(b.time));
    createSeriesMarkers(series, markers);
    chart.timeScale().fitContent();

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height)
      });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, positive, trades]);

  return <div className="price-chart" ref={containerRef} aria-label="Grafica de precio ficticio" />;
}
