import type { GlucoseRecord } from "../data/types";

// 輕量 SVG 折線圖（DESIGN.md §13）：Primary Blue 線、淡綠目標範圍區、
// Divider 網格、Text Secondary 座標。圖表須配文字摘要，非唯一資訊來源。
const W = 320;
const H = 200;
const PAD = { top: 16, right: 14, bottom: 30, left: 34 };
const Y_MIN = 2;
const Y_MAX = 16;

// 目標範圍（餐前 4–7 參考、餐後 10 上限；此處以柔和綠帶 4–10 表達整體目標帶，
// 與 spec 圖表「餐前 4–7 參考區、餐後 10 上限」一致的視覺呈現）
const TARGET_LOW = 4;
const TARGET_HIGH = 10;

function yPos(v: number) {
  const clamped = Math.max(Y_MIN, Math.min(Y_MAX, v));
  const t = (clamped - Y_MIN) / (Y_MAX - Y_MIN);
  return PAD.top + (1 - t) * (H - PAD.top - PAD.bottom);
}

export function TrendChart({ records }: { records: GlucoseRecord[] }) {
  // 只取有值紀錄，依時間昇序
  const pts = records
    .filter((r) => r.value > 0)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  if (pts.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-[16px] bg-chart-surface">
        <span className="t-body text-text-muted">此範圍內未有血糖數據</span>
      </div>
    );
  }

  const minTs = pts[0].timestamp;
  const maxTs = pts[pts.length - 1].timestamp;
  const span = Math.max(1, maxTs - minTs);
  const xPos = (ts: number) =>
    PAD.left + ((ts - minTs) / span) * (W - PAD.left - PAD.right);

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xPos(p.timestamp).toFixed(1)} ${yPos(p.value).toFixed(1)}`)
    .join(" ");

  const yTicks = [4, 8, 12, 16];
  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`血糖趨勢圖，共 ${pts.length} 筆，目標範圍 ${TARGET_LOW} 至 ${TARGET_HIGH} mmol/L`}
    >
      {/* 目標範圍帶 */}
      <rect
        x={PAD.left}
        y={yPos(TARGET_HIGH)}
        width={W - PAD.left - PAD.right}
        height={yPos(TARGET_LOW) - yPos(TARGET_HIGH)}
        fill="#BFE3C6"
        opacity={0.35}
      />
      {/* 網格 + Y 標籤 */}
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yPos(t)}
            y2={yPos(t)}
            stroke="var(--color-divider)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 6}
            y={yPos(t) + 4}
            textAnchor="end"
            fontSize="11"
            fill="var(--color-text-secondary)"
          >
            {t}
          </text>
        </g>
      ))}
      {/* X 起訖日期 */}
      <text x={PAD.left} y={H - 10} fontSize="11" fill="var(--color-text-secondary)">
        {fmtDate(minTs)}
      </text>
      <text
        x={W - PAD.right}
        y={H - 10}
        textAnchor="end"
        fontSize="11"
        fill="var(--color-text-secondary)"
      >
        {fmtDate(maxTs)}
      </text>

      {/* 折線 */}
      <path
        d={linePath}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 資料點 */}
      {pts.map((p) => (
        <circle
          key={p.id}
          cx={xPos(p.timestamp)}
          cy={yPos(p.value)}
          r={3.2}
          fill="white"
          stroke="var(--color-primary)"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
