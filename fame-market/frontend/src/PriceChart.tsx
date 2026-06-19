import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  Activity,
  AreaChart,
  ChartCandlestick,
  Crosshair,
  LineChart,
  MousePointer2,
  PencilRuler,
  RotateCcw,
  Ruler,
  Trash2
} from 'lucide-react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type SeriesType,
  type UTCTimestamp
} from 'lightweight-charts';
import type { PricePoint, Trade } from './types';

interface PriceChartProps {
  data: PricePoint[];
  positive: boolean;
  trades?: Trade[];
}

type ChartInterval = '15m' | '1h' | '4h' | '1d' | '1w' | 'all';
type ChartStyle = 'candles' | 'area' | 'line';
type ToolMode = 'cursor' | 'trend' | 'horizontal' | 'measure';
type ActiveSeries = ISeriesApi<SeriesType, UTCTimestamp>;

interface CandlePoint {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface DrawingPoint {
  x: number;
  y: number;
  price?: number;
  priceLabel?: string;
}

interface Drawing {
  id: string;
  type: Exclude<ToolMode, 'cursor'>;
  points: DrawingPoint[];
}

const intervals: Array<{ id: ChartInterval; label: string; title: string }> = [
  { id: '15m', label: '15m', title: 'Velas de 15 minutos' },
  { id: '1h', label: '1h', title: 'Velas de 1 hora' },
  { id: '4h', label: '4h', title: 'Velas de 4 horas' },
  { id: '1d', label: '1D', title: 'Velas diarias' },
  { id: '1w', label: '1S', title: 'Velas semanales' },
  { id: 'all', label: 'Todo', title: 'Toda la serie disponible' }
];

const intervalSeconds: Record<Exclude<ChartInterval, 'all'>, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
  '1d': 24 * 60 * 60,
  '1w': 7 * 24 * 60 * 60
};

function sortPoints(data: PricePoint[]) {
  return data
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
    .sort((a, b) => a.time - b.time);
}

function resolveIntervalSeconds(interval: ChartInterval, points: PricePoint[]) {
  if (interval !== 'all') return intervalSeconds[interval];
  if (points.length < 2) return intervalSeconds['1h'];
  const span = points[points.length - 1].time - points[0].time;
  if (span <= 8 * 60 * 60) return intervalSeconds['15m'];
  if (span <= 3 * 24 * 60 * 60) return intervalSeconds['1h'];
  if (span <= 21 * 24 * 60 * 60) return intervalSeconds['4h'];
  return intervalSeconds['1d'];
}

function interpolatePoints(points: PricePoint[], seconds: number) {
  if (points.length < 2) return points;
  const expanded: PricePoint[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    expanded.push(current);
    const gap = next.time - current.time;
    const slots = Math.min(Math.max(Math.floor(gap / seconds) - 1, 0), 120);
    for (let step = 1; step <= slots; step += 1) {
      const ratio = step / (slots + 1);
      const wave = Math.sin((current.time + step * seconds) / 9973) * 0.0015;
      expanded.push({
        time: Math.round(current.time + gap * ratio),
        value: current.value + (next.value - current.value) * ratio + current.value * wave
      });
    }
  }
  expanded.push(points[points.length - 1]);
  return expanded;
}

function buildCandles(data: PricePoint[], seconds: number): CandlePoint[] {
  const points = interpolatePoints(sortPoints(data), seconds);
  if (!points.length) return [];

  const buckets = new Map<number, PricePoint[]>();
  for (const point of points) {
    const bucket = Math.floor(point.time / seconds) * seconds;
    const bucketPoints = buckets.get(bucket) ?? [];
    bucketPoints.push(point);
    buckets.set(bucket, bucketPoints);
  }

  let previousClose: number | null = null;
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, bucketPoints], index) => {
      const ordered = bucketPoints.sort((a, b) => a.time - b.time);
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const values = ordered.map((point) => point.value);
      const open = previousClose ?? first.value;
      const close = last.value;
      const bodyHigh = Math.max(open, close, ...values);
      const bodyLow = Math.min(open, close, ...values);
      const wick = Math.max(Math.abs(close - open) * 0.35, close * 0.0009, 0.03);
      const wave = 0.75 + (Math.abs(Math.sin(index * 1.7)) * 0.5);
      previousClose = close;
      return {
        time: time as UTCTimestamp,
        open,
        high: bodyHigh + wick * wave,
        low: Math.max(0.01, bodyLow - wick * (2 - wave)),
        close
      };
    });
}

function markersFromTrades(trades: Trade[]) {
  return trades
    .map((trade): SeriesMarker<UTCTimestamp> => ({
      time: Math.floor(new Date(trade.createdAt).getTime() / 1000) as UTCTimestamp,
      position: trade.side === 'buy' ? 'belowBar' : 'aboveBar',
      color: trade.side === 'buy' ? '#168f5c' : '#d94b43',
      shape: trade.side === 'buy' ? 'arrowUp' : 'arrowDown',
      text: `${trade.side === 'buy' ? 'Compra' : 'Venta'} ${trade.quantity}`,
      size: 1
    }))
    .sort((a, b) => Number(a.time) - Number(b.time));
}

export function PriceChart({ data, positive, trades = [] }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ActiveSeries | null>(null);
  const [interval, setInterval] = useState<ChartInterval>('1h');
  const [chartStyle, setChartStyle] = useState<ChartStyle>('candles');
  const [toolMode, setToolMode] = useState<ToolMode>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [draftPoint, setDraftPoint] = useState<DrawingPoint | null>(null);

  const sortedData = useMemo(() => sortPoints(data), [data]);
  const candleSeconds = useMemo(
    () => resolveIntervalSeconds(interval, sortedData),
    [interval, sortedData]
  );
  const candles = useMemo(
    () => buildCandles(sortedData, candleSeconds),
    [sortedData, candleSeconds]
  );

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
        timeVisible: true,
        secondsVisible: false
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#7c7b75', labelBackgroundColor: '#111111' },
        horzLine: { color: '#7c7b75', labelBackgroundColor: '#111111' }
      }
    });
    chartRef.current = chart;

    let series: ActiveSeries;
    if (chartStyle === 'candles') {
      series = chart.addSeries(CandlestickSeries, {
        upColor: '#168f5c',
        downColor: '#d94b43',
        borderUpColor: '#168f5c',
        borderDownColor: '#d94b43',
        wickUpColor: '#168f5c',
        wickDownColor: '#d94b43',
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
      }) as ActiveSeries;
      series.setData(candles);
    } else if (chartStyle === 'line') {
      series = chart.addSeries(LineSeries, {
        color: accent,
        lineWidth: 3,
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
      }) as ActiveSeries;
      series.setData(candles.map((point) => ({ time: point.time, value: point.close })));
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: accent,
        topColor: positive ? 'rgba(22, 143, 92, 0.22)' : 'rgba(217, 75, 67, 0.20)',
        bottomColor: 'rgba(255, 255, 255, 0)',
        lineWidth: 3,
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
      }) as ActiveSeries;
      series.setData(candles.map((point) => ({ time: point.time, value: point.close })));
    }

    seriesRef.current = series;
    createSeriesMarkers(series, markersFromTrades(trades));
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
      seriesRef.current = null;
    };
  }, [candles, chartStyle, positive, trades]);

  function resetZoom() {
    chartRef.current?.timeScale().fitContent();
  }

  function startTool(nextTool: ToolMode) {
    setToolMode(nextTool);
    setDraftPoint(null);
  }

  function pointFromEvent(event: MouseEvent<SVGSVGElement>): DrawingPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const price = seriesRef.current?.coordinateToPrice(event.clientY - rect.top);
    return {
      x,
      y,
      price: typeof price === 'number' ? price : undefined,
      priceLabel: typeof price === 'number' ? `${price.toFixed(2)} FC` : undefined
    };
  }

  function handleOverlayClick(event: MouseEvent<SVGSVGElement>) {
    if (toolMode === 'cursor') return;
    const point = pointFromEvent(event);
    if (toolMode === 'horizontal') {
      setDrawings((current) => [
        ...current,
        { id: `draw-${Date.now()}`, type: 'horizontal', points: [point] }
      ]);
      return;
    }

    if (!draftPoint) {
      setDraftPoint(point);
      return;
    }
    setDrawings((current) => [
      ...current,
      { id: `draw-${Date.now()}`, type: toolMode, points: [draftPoint, point] }
    ]);
    setDraftPoint(null);
  }

  return (
    <section className="chart-shell" aria-label="Grafica de precio ficticio">
      <div className="chart-toolbar chart-toolbar--advanced">
        <div className="chart-control-group time-ranges" aria-label="Temporalidad de velas">
          {intervals.map((option) => (
            <button
              key={option.id}
              className={interval === option.id ? 'is-active' : ''}
              onClick={() => setInterval(option.id)}
              title={option.title}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="chart-control-group chart-style-toggle" aria-label="Tipo de grafica">
          <button
            className={chartStyle === 'candles' ? 'is-active' : ''}
            onClick={() => setChartStyle('candles')}
            title="Velas japonesas"
            type="button"
          >
            <ChartCandlestick size={16} />
          </button>
          <button
            className={chartStyle === 'area' ? 'is-active' : ''}
            onClick={() => setChartStyle('area')}
            title="Area"
            type="button"
          >
            <AreaChart size={16} />
          </button>
          <button
            className={chartStyle === 'line' ? 'is-active' : ''}
            onClick={() => setChartStyle('line')}
            title="Linea"
            type="button"
          >
            <LineChart size={16} />
          </button>
        </div>

        <div className="chart-control-group chart-tools" aria-label="Herramientas de grafica">
          <button
            className={toolMode === 'cursor' ? 'is-active' : ''}
            onClick={() => startTool('cursor')}
            title="Cursor"
            type="button"
          >
            <MousePointer2 size={16} />
          </button>
          <button
            className={toolMode === 'trend' ? 'is-active' : ''}
            onClick={() => startTool('trend')}
            title="Linea de tendencia"
            type="button"
          >
            <PencilRuler size={16} />
          </button>
          <button
            className={toolMode === 'horizontal' ? 'is-active' : ''}
            onClick={() => startTool('horizontal')}
            title="Linea horizontal"
            type="button"
          >
            <Crosshair size={16} />
          </button>
          <button
            className={toolMode === 'measure' ? 'is-active' : ''}
            onClick={() => startTool('measure')}
            title="Medir variacion porcentual"
            type="button"
          >
            <Ruler size={16} />
          </button>
          <button onClick={resetZoom} title="Ajustar grafica" type="button">
            <RotateCcw size={16} />
          </button>
          <button onClick={() => setDrawings([])} title="Limpiar dibujos" type="button">
            <Trash2 size={16} />
          </button>
        </div>

        <span>
          <Activity size={15} />
          Actualizacion en vivo
        </span>
      </div>

      <div className="price-chart-wrap">
        <div className="price-chart" ref={containerRef} />
        <svg
          className={`chart-drawing-layer ${toolMode !== 'cursor' ? 'is-drawing' : ''}`}
          onClick={handleOverlayClick}
          aria-hidden="true"
        >
          {drawings.map((drawing) => {
            if (drawing.type === 'horizontal') {
              return (
                <g key={drawing.id}>
                  <line
                    x1="0%"
                    x2="100%"
                    y1={`${drawing.points[0].y * 100}%`}
                    y2={`${drawing.points[0].y * 100}%`}
                  />
                  {drawing.points[0].priceLabel && (
                    <text x="99%" y={`${drawing.points[0].y * 100}%`}>
                      {drawing.points[0].priceLabel}
                    </text>
                  )}
                </g>
              );
            }

            const [start, end] = drawing.points;
            if (drawing.type === 'measure') {
              const variation =
                start.price && end.price
                  ? ((end.price - start.price) / start.price) * 100
                  : 0;
              const variationLabel = `${variation >= 0 ? '+' : ''}${variation.toFixed(2)}%`;
              return (
                <g
                  className={`chart-measurement ${
                    variation >= 0 ? 'is-positive' : 'is-negative'
                  }`}
                  key={drawing.id}
                >
                  <line
                    x1={`${start.x * 100}%`}
                    y1={`${start.y * 100}%`}
                    x2={`${end.x * 100}%`}
                    y2={`${end.y * 100}%`}
                  />
                  <circle cx={`${start.x * 100}%`} cy={`${start.y * 100}%`} r="4" />
                  <circle cx={`${end.x * 100}%`} cy={`${end.y * 100}%`} r="4" />
                  <text
                    x={`${((start.x + end.x) / 2) * 100}%`}
                    y={`${((start.y + end.y) / 2) * 100}%`}
                    dy="-8"
                  >
                    {variationLabel}
                  </text>
                </g>
              );
            }

            return (
              <line
                key={drawing.id}
                x1={`${start.x * 100}%`}
                y1={`${start.y * 100}%`}
                x2={`${end.x * 100}%`}
                y2={`${end.y * 100}%`}
              />
            );
          })}
          {draftPoint && (
            <circle cx={`${draftPoint.x * 100}%`} cy={`${draftPoint.y * 100}%`} r="4" />
          )}
        </svg>
      </div>
    </section>
  );
}

