import { useEffect, useId, useRef, useState } from "react";

function fmtFullDate(ts: number) {
  const d = new Date(ts);
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mo}-${day}`;
}

// 依「選定時間範圍」渲染的折線圖（DESIGN.md §13）：
// X 軸日期刻度由父層依所選範圍計算後傳入（每個刻度為一個 timestamp），
// Y 軸刻度與可選目標範圍帶可配置，供血糖及實測糖化紀錄共用。
export interface ChartPoint {
  ts: number;
  value: number;
}


export function RangeTrendChart({
  presentation,
  className,
  points,
  domainStart,
  domainEnd,
  yMin,
  yMax,
  yTicks,
  xTicks,
  band,
  formatY,
  formatX,
  formatValue = (v) => `${v}`,
  ariaLabel,
  showAllDots = true,
  stretch = false,
  latestValueLabel = false,
  compact = false,
  overview = false,
}: {
  presentation?: "glucose";
  className?: string;
  points: ChartPoint[];
  domainStart: number;
  domainEnd: number;
  yMin: number;
  yMax: number;
  yTicks: number[];
  xTicks: number[];
  band?: { low: number; high: number };
  formatY: (v: number) => string;
  formatX: (ts: number) => string;
  formatValue?: (v: number) => string;
  ariaLabel: string;
  showAllDots?: boolean;
  stretch?: boolean;
  latestValueLabel?: boolean;
  compact?: boolean;
  overview?: boolean;
}) {
  const refined = presentation === "glucose";
  const [fontScale,setFontScale]=useState(1);
  const chartRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!refined) return;
    const update = () => {
      const referenceWidth = overview ? 334 : compact ? 326 : 340;
      const width = chartRef.current?.getBoundingClientRect().width || referenceWidth;
      setFontScale(Math.max(1, parseFloat(getComputedStyle(document.documentElement).fontSize) / 16, compact ? referenceWidth / width : 1));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {attributes:true, attributeFilter:['class','style']});
    const resize = compact ? new ResizeObserver(update) : null;
    if (chartRef.current) resize?.observe(chartRef.current);
    return () => { observer.disconnect(); resize?.disconnect(); };
  }, [refined, compact, overview]);
  const H = refined ? (overview ? 152 : compact ? 210 : 270) * fontScale : 214;
  const PAD = refined ? compact
    ? { top:(overview?11.88:18)*fontScale, right:(overview?46:38)*fontScale, bottom:(overview?45.08:48)*fontScale, left:Math.max(42, ...yTicks.map(tick => formatY(tick).length * 9 + 8))*fontScale }
    : { top:20*fontScale, right:16, bottom:40*fontScale, left:58*fontScale }
    : {top:14,right:16,bottom:34,left:38};
  const gradId = useId();
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => setActive(null), [points]);
  // 全屏橫向時讓 viewBox 跟可用的寬屏比例一致。高度會隨字級增加，
  // 所以寬度也要同步增加，否則 SVG 會為了保持比例縮在畫面中央。
  const W = overview ? 334 : stretch ? Math.round(H * 3.1) : refined && compact ? 326 : 340;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const span = Math.max(1, domainEnd - domainStart);

  const xPos = (ts: number) => PAD.left + ((ts - domainStart) / span) * plotW;
  const yPos = (v: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, v));
    const t = (clamped - yMin) / (yMax - yMin || 1);
    return PAD.top + (1 - t) * plotH;
  };

  const sorted = points
    .filter((p) => p.ts >= domainStart && p.ts <= domainEnd)
    .slice()
    .sort((a, b) => a.ts - b.ts);

  const linePath = sorted
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${xPos(p.ts).toFixed(1)} ${yPos(p.value).toFixed(1)}`,
    )
    .join(" ");

  const areaPath =
    sorted.length > 0
      ? `${linePath} L ${xPos(sorted[sorted.length - 1].ts).toFixed(1)} ${(
          PAD.top + plotH
        ).toFixed(1)} L ${xPos(sorted[0].ts).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`
      : "";

  const uniqueTicks = xTicks.filter((t, i, a) => a.findIndex(v => formatX(v) === formatX(t)) === i);
  const labelWidth = Math.max(0, ...uniqueTicks.slice(0, -1).map(tick => formatX(tick).length * 8.5 * fontScale));
  const maxTicks = Math.max(2, Math.min(
    Math.round((overview ? 4 : stretch || compact ? 7 : 4) / fontScale),
    refined && compact ? Math.floor(plotW / (labelWidth + 6)) + 1 : Infinity,
  ));
  const displayTicks = refined && uniqueTicks.length > maxTicks ? Array.from({length:maxTicks}, (_, i) => uniqueTicks[Math.round(i * (uniqueTicks.length - 1) / (maxTicks - 1))]) : refined ? uniqueTicks : xTicks;
  return (
    <svg
      ref={chartRef}
      viewBox={`0 0 ${W} ${H}`}
      className={[refined ? "glucose-chart" : "", "w-full", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-line, var(--color-primary))" stopOpacity={0.18} />
          <stop offset="100%" stopColor="var(--chart-line, var(--color-primary))" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* 目標範圍帶 */}
      {band && (
        <rect
          x={PAD.left}
          y={yPos(band.high)}
          width={plotW}
          height={yPos(band.low) - yPos(band.high)}
          fill="#BFE3C6"
          opacity={0.32}
          rx={6}
        />
      )}

      {/* 水平網格 + Y 刻度 */}
      {(overview ? yTicks.filter((_,i)=>i===yTicks.length-1||i%Math.ceil((yTicks.length-1)/3)===0) : yTicks).map((t) => (
        <g key={`y-${t}`}>
          <line
            x1={refined && compact ? PAD.left - 8 * fontScale : PAD.left}
            x2={refined && compact ? W - (overview?34:26) * fontScale : W - PAD.right}
            y1={yPos(t)}
            y2={yPos(t)}
            stroke="var(--chart-grid, var(--color-divider))"
            strokeWidth={1}
            strokeDasharray={refined ? undefined : "3 4"}
          />
          <text
            x={refined && compact ? 0 : PAD.left - 8}
            y={yPos(t) + (refined && compact ? (overview?11.9:8) * fontScale : 4)}
            textAnchor={refined && compact ? "start" : "end"}
            fontSize={refined ? (compact ? 16 : 18) * fontScale : 11}
            fill="var(--chart-label, var(--color-text-muted))"
          >
            {formatY(t)}
          </text>
        </g>
      ))}

      {/* X 日期刻度 */}
      {displayTicks.map((ts, i) => {
        const x = xPos(ts);
        const singleOverview = overview && displayTicks.length === 1;
        const lastOverview = overview && !singleOverview && i === displayTicks.length - 1;
        const anchor = singleOverview ? "middle" : lastOverview ? "end" : refined && compact ? "start" :
          i === 0 ? "start" : i === displayTicks.length - 1 ? "end" : "middle";
        return (
          <text
            key={`x-${ts}`}
            x={refined && compact ? x - (singleOverview?0:lastOverview?3:12) * fontScale : x}
            y={refined && compact ? H - (overview?12.06:7) * fontScale : H - 12}
            textAnchor={anchor}
            fontSize={refined ? (compact ? 16 : 18) * fontScale : 11}
            fill="var(--chart-label, var(--color-text-muted))"
          >
            {formatX(ts)}
          </text>
        );
      })}

      {sorted.length > 0 && (
        <>
          {/* 面積填色 */}
          {!refined && <path d={areaPath} fill={`url(#${gradId})`} />}
          {/* 折線 */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--chart-line, var(--color-primary))"
            strokeWidth={refined && compact ? 3 : 2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Pencil 18 keeps 8px markers while compressing the plot from 180 to 118.8px. */}
          {showAllDots
            ? sorted.map((p, i) => (
                <circle
                  key={`d-${p.ts}-${i}`}
                  cx={xPos(p.ts)}
                  cy={yPos(p.value) + (overview ? 1.36 * fontScale : 0)}
                  r={overview ? 4 * fontScale : refined && compact ? 3 : 3.2}
                  fill="white"
                  stroke="var(--chart-line, var(--color-primary))"
                  strokeWidth={2}
                />
              ))
            : (() => {
                const last = sorted[sorted.length - 1];
                return (
                  <circle
                    cx={xPos(last.ts)}
                    cy={yPos(last.value)}
                    r={5}
                    fill="var(--chart-line, var(--color-primary))"
                  />
                );
              })()}

          {latestValueLabel && active === null && (() => {
            const last = sorted[sorted.length - 1];
            const width = (compact ? 34 : 48) * fontScale;
            const height = (compact ? 23 : 28) * fontScale;
            const x = Math.max(PAD.left, Math.min(W - width - 2, xPos(last.ts) - width / 2));
            const pointY = yPos(last.value);
            const above = pointY - height - 8;
            const y = above < 2 ? pointY + 8 : above;
            return <g pointerEvents="none" aria-hidden="true">
              <rect x={x} y={y} width={width} height={height} rx={11} fill="var(--chart-line, var(--color-primary))" opacity={.88}/>
              <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fontSize={(compact ? 14 : 18) * fontScale} fill="white">{last.value.toFixed(1)}</text>
            </g>;
          })()}

          {/* 懸浮：垂直參考線 + 資料點高亮 + tooltip */}
          {active !== null && sorted[active] && (() => {
            const p = sorted[active];
            const px = xPos(p.ts);
            const py = yPos(p.value);
            const tw = refined ? Math.min(W-4,210*fontScale) : 150;
            const th = refined ? 64*fontScale : 48;
            let tx = px + 12;
            if (tx + tw > W - 2) tx = px - 12 - tw;
            if (tx < 2) tx = 2;
            let ty = py - th - 10;
            if (ty < PAD.top) ty = py + 12;
            ty = Math.max(2, Math.min(H - th - 2, ty));
            return (
              <g>
                <line
                  x1={px}
                  x2={px}
                  y1={PAD.top}
                  y2={PAD.top + plotH}
                  stroke="var(--chart-label, var(--color-text-muted))"
                  strokeWidth={1}
                  opacity={0.5}
                />
                <circle
                  cx={px}
                  cy={py}
                  r={5}
                  fill="var(--chart-line, var(--color-primary))"
                  stroke="white"
                  strokeWidth={2}
                />
                <g style={{ filter: "drop-shadow(0 2px 7px rgba(15,23,42,0.20))" }}>
                  <rect
                    x={tx}
                    y={ty}
                    width={tw}
                    height={th}
                    rx={12}
                    fill="var(--color-surface)"
                  />
                  <text
                    x={tx + 12}
                    y={ty + (refined ? 24*fontScale : 20)}
                    fontSize={refined ? 18*fontScale : 13}
                    fontWeight={700}
                    fill="var(--color-text-primary)"
                  >
                    {fmtFullDate(p.ts)}
                  </text>
                  <text x={tx + 12} y={ty + (refined ? 49*fontScale : 37)} fontSize={refined ? 18*fontScale : 12} fill="var(--chart-label, var(--color-text-muted))">
                    {refined ? "" : "數值："}
                    <tspan fontWeight={700} fill="var(--chart-line, var(--color-primary))">
                      {formatValue(p.value)}
                    </tspan>
                  </text>
                </g>
              </g>
            );
          })()}

          {/* 透明感應區：滑鼠 / 觸控命中資料點 */}
          {sorted.map((p, i) => (
            <circle
              key={`hit-${p.ts}-${i}`}
              cx={xPos(p.ts)}
              cy={yPos(p.value)}
              r={14}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
              onPointerLeave={() => setActive((cur) => (cur === i ? null : cur))}
            />
          ))}
        </>
      )}
    </svg>
  );
}
