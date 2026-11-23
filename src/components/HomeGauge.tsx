import type { GlucoseRecord } from "../data/types";
import { glucoseStatus } from "../data/constants";

// 首頁 Hero 卡的半圓血糖儀表 —— 與血糖記錄頁共用相同幾何參數
// （SVG 220×140、圓心 (110,128)、半徑 96、線寬 22、0–33 mmol/L）。
const SVG_W = 220;
const SVG_H = 140;
const CX = 110;
const CY = 128;
const R = 96;
const STROKE = 22;
const GAUGE_MAX = 33;

// 弧線填色（生動的儀表色維持不變，設計 token 專用於文字/表面）。
const ARC_COLOR: Record<string, string> = {
  low: "#f5a623",
  ideal: "#52c07a",
  high: "#e05a4e",
};

function polarPt(value: number) {
  const t = Math.max(0, Math.min(1, value / GAUGE_MAX));
  const angle = Math.PI * (1 - t);
  return { x: CX + R * Math.cos(angle), y: CY - R * Math.sin(angle) };
}

function arcD(fromVal: number, toVal: number) {
  const a = polarPt(fromVal);
  const b = polarPt(toVal);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export function HomeGauge({ record }: { record: GlucoseRecord | null }) {
  const status = record ? glucoseStatus(record.value, record.timeType) : null;
  const arcColor = status ? ARC_COLOR[status] : null;
  const fillVal = record ? Math.min(record.value, GAUGE_MAX) : 0;
  const dotPt = polarPt(fillVal > 0 ? fillVal : 0.01);

  return (
    <div className="home-gauge">
      <div className="home-gauge-dial">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width={SVG_W}
          height={SVG_H}
          aria-hidden="true"
          style={{ overflow: "visible" }}
        >
          {/* 軌道弧（淡灰） */}
          <path d={arcD(0, GAUGE_MAX)} stroke="#e7ebe2" strokeWidth={STROKE} strokeLinecap="round" fill="none" />
          {/* 有效弧 */}
          {record && arcColor && fillVal > 0 && (
            <path d={arcD(0, fillVal)} stroke={arcColor} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
          )}
          {/* 端點圓點 */}
          {record && arcColor && fillVal > 0 && <circle cx={dotPt.x} cy={dotPt.y} r={10} fill={arcColor} />}
        </svg>

        {/* 讀數浮於弧口內 */}
        <div
          className="home-gauge-reading"
        >
          <span className="home-glucose tnum">{record ? record.value.toFixed(1) : "—"}</span>
          <span className="home-unit">
            mmol/L
          </span>
        </div>
      </div>
    </div>
  );
}
