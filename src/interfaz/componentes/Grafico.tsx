import { useEffect, useRef } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/**
 * Gráfico liviano (uPlot) sobre un eje de categorías (semanas o meses).
 * tipo "barras" para cantidades, "linea" para promedios.
 */
export function Grafico({ etiquetas, valores, tipo, min, max, formatoY, marcasY, alto = 200, nombre }: {
  marcasY?: number[];
  etiquetas: string[];
  valores: (number | null)[];
  tipo: 'barras' | 'linea';
  min?: number;
  max?: number;
  formatoY?: (v: number) => string;
  alto?: number;
  nombre: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const n = etiquetas.length;
    const color = css(tipo === 'barras' ? '--rojo' : '--verde') || '#c8102e';
    const texto = css('--texto-suave') || '#777';
    const rejilla = css('--borde') || '#ddd';
    const salto = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(el.clientWidth / 48))));

    const opciones: uPlot.Options = {
      width: el.clientWidth,
      height: alto,
      legend: { show: false },
      cursor: { drag: { x: false, y: false }, points: { size: 8 } },
      scales: {
        x: { time: false, range: [-0.6, n - 0.4] },
        y: { range: (_u, dMin, dMax) => [min ?? Math.min(0, dMin ?? 0), max ?? Math.max(1, Math.ceil((dMax ?? 1) * 1.15))] },
      },
      axes: [
        {
          stroke: texto,
          grid: { show: false },
          ticks: { show: false },
          splits: () => etiquetas.map((_, i) => i).filter((i) => i % salto === 0),
          values: (_u, splits) => splits.map((i) => etiquetas[i] ?? ''),
        },
        {
          stroke: texto,
          grid: { stroke: rejilla, width: 1 },
          ticks: { show: false },
          size: 36,
          ...(marcasY ? { splits: () => marcasY } : {}),
          values: (_u, splits) => splits.map((v) => (formatoY ? formatoY(v) : Number.isInteger(v) ? String(v) : '')),
        },
      ],
      series: [
        {},
        tipo === 'barras'
          ? { label: nombre, fill: color, stroke: color, width: 0, paths: uPlot.paths.bars!({ size: [0.7, 48], gap: 2 }), points: { show: false } }
          : { label: nombre, stroke: color, width: 3, spanGaps: true, points: { show: true, size: 6, fill: color } },
      ],
    };
    const grafico = new uPlot(opciones, [etiquetas.map((_, i) => i), valores], el);
    const obs = new ResizeObserver(() => grafico.setSize({ width: el.clientWidth, height: alto }));
    obs.observe(el);
    return () => {
      obs.disconnect();
      grafico.destroy();
    };
  }, [etiquetas.join('|'), valores.join('|'), tipo, alto]);

  return <div ref={ref} class="grafico" role="img" aria-label={nombre} />;
}
