import type { GlucoseRecord } from "../data/types"
import { glucoseStatus, slotLabelFor, STATUS_TEXT } from "../data/constants"

// ─── Gauge geometry ──────────────────────────────────────────────────────────
// SVG canvas: 220 × 140. Semicircle open at bottom, arc spans 180°.
// Centre-of-arc at (110, 128); radius 96px; stroke 22px.
// Left terminus  → angle 180° → (14,  128)
// Right terminus → angle   0° → (206, 128)
// Dot travels from left end (low value) toward top (high value).
const SVG_W = 220
const SVG_H = 140
const CX = 110
const CY = 128
const R = 96
const STROKE = 22
const GAUGE_MAX = 33 // 0–33 mmol/L covers clinical diabetic range

function polarPt(value: number) {
  const t = Math.max(0, Math.min(1, value / GAUGE_MAX))
  // 180° (left) → 0° (right), going counter-clockwise over the top
  const angle = Math.PI * (1 - t)
  return {
    x: CX + R * Math.cos(angle),
    y: CY - R * Math.sin(angle),
  }
}

function arcD(fromVal: number, toVal: number) {
  const a = polarPt(fromVal)
  const b = polarPt(toVal)
  // Semicircle gauge — active arc always < 180°, large-arc-flag always 0
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

// ─── Colour maps — vivid arc fills stay as-is (design tokens are text/surface only)
const ARC_COLOR: Record<string, string> = {
  low: "#F5A623",
  ideal: "#52C07A",
  high: "#E05A4E",
}
const TEXT_COLOR: Record<string, string> = {
  low: "var(--color-warning)",
  ideal: "var(--color-positive)",
  high: "var(--color-danger)",
}
const BADGE_BG: Record<string, string> = {
  low: "var(--color-warning-surface)",
  ideal: "var(--color-positive-surface)",
  high: "var(--color-danger-surface)",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
function fmtTime(ts: number) {
  const d = new Date(ts)
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  )
}

// ─── Component ───────────────────────────────────────────────────────────────
export function GlucoseGauge({
  record,
  onClick,
}: {
  record: GlucoseRecord | null
  onClick: () => void
}) {
  const status = record ? glucoseStatus(record.value, record.timeType) : null
  const statusText = status ? STATUS_TEXT[status] : "未有紀錄"
  const arcColor = status ? ARC_COLOR[status] : null
  const valColor = status ? TEXT_COLOR[status] : "var(--color-text-muted)"
  const badgeBg = status ? BADGE_BG[status] : "var(--color-surface-subtle)"
  const fillVal = record ? Math.min(record.value, GAUGE_MAX) : 0
  const dotPt = polarPt(fillVal > 0 ? fillVal : 0.01)

  const ariaLabel = record
    ? `最近血糖 ${record.value.toFixed(1)} mmol/L，${statusText}，${fmtDate(record.timestamp)} ${slotLabelFor(record.timeType, record.mealTag)} ${fmtTime(record.timestamp)}。點擊記錄新的血糖。`
    : "尚未有血糖紀錄。點擊記錄血糖。"

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="group relative w-full overflow-hidden rounded-[28px] bg-surface transition-all duration-200"
      style={{
        boxShadow: "0 2px 20px rgba(0,0,0,0.08)",
        minHeight: 200,
      }}
    >
      {/* ══ Card content ══════════════════════════════════════════════════════ */}
      <div className="relative z-10">
        {/* Title row */}
        <div className="flex items-center gap-1.5 px-6 pt-5 pb-0">
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              letterSpacing: -0.2,
            }}
          >
            最近血糖
          </span>
          {/* ⓘ icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6.5" stroke="var(--color-border)" strokeWidth="1.3" />
            <path
              d="M8 7v4.5"
              stroke="var(--color-border)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <circle cx="8" cy="5.25" r="0.8" fill="var(--color-border)" />
          </svg>
        </div>

        {/* Main row: gauge left | info right */}
        <div className="flex items-center px-4 pt-1 pb-2">
          {/* ── Left: gauge SVG + value inside ────────────────────────────── */}
          <div
            className="relative flex-shrink-0"
            style={{ width: SVG_W, height: SVG_H }}
          >
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              width={SVG_W}
              height={SVG_H}
              aria-hidden="true"
              style={{ overflow: "visible" }}
            >
              {/* Track arc: full 180° in pale lavender */}
              <path
                d={arcD(0, GAUGE_MAX)}
                stroke="#DFE3F4"
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
              />

              {/* Active arc */}
              {record && arcColor && fillVal > 0 && (
                <path
                  d={arcD(0, fillVal)}
                  stroke={arcColor}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  fill="none"
                />
              )}

              {/* Tip dot — solid filled circle at arc end */}
              {record && arcColor && fillVal > 0 && (
                <circle cx={dotPt.x} cy={dotPt.y} r={10} fill={arcColor} />
              )}
            </svg>

            {/* Value + unit — float inside the arc opening */}
            <div
              className="pointer-events-none absolute flex flex-col items-center"
              style={{
                left: "50%",
                transform: "translateX(-50%)",
                bottom: 2,
              }}
            >
              <span
                className="tnum"
                style={{
                  fontSize: 46,
                  fontWeight: 700,
                  color: valColor,
                  lineHeight: 1,
                  letterSpacing: -1.5,
                }}
              >
                {record ? record.value.toFixed(1) : "—"}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-text-muted)",
                  marginTop: 2,
                }}
              >
                mmol/L
              </span>
            </div>
          </div>

          {/* ── Right: status badge + date + time ─────────────────────────── */}
          <div
            className="flex flex-1 flex-col items-start"
            style={{ gap: 8, paddingLeft: 12, paddingBottom: 18 }}
          >
            {/* Status badge */}
            <span
              style={{
                backgroundColor: badgeBg,
                color: valColor,
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 20,
                paddingInline: 14,
                paddingBlock: 5,
                display: "inline-block",
              }}
            >
              {statusText}
            </span>

            {record ? (
              <>
                {/* Date */}
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                    lineHeight: 1.2,
                    marginTop: 2,
                  }}
                >
                  {fmtDate(record.timestamp)}
                </span>

                {/* Clock + slot + time */}
                <div
                  className="flex items-center"
                  style={{ gap: 5, marginTop: 2 }}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 13 13"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="6.5"
                      cy="6.5"
                      r="5.4"
                      stroke="var(--color-text-muted)"
                      strokeWidth="1.1"
                    />
                    <path
                      d="M6.5 3.8v3l1.7 1.1"
                      stroke="var(--color-text-muted)"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    {`${slotLabelFor(record.timeType, record.mealTag)} ${fmtTime(record.timestamp)}`}
                  </span>
                </div>
              </>
            ) : (
              <span style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
                點擊即可記錄
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ══ Soft layered wave decoration at bottom ════════════════════════════ */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0"
        style={{
          height: "30%",
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          overflow: "hidden",
        }}
      >
        <svg
          viewBox="0 0 400 72"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", display: "block" }}
          aria-hidden="true"
        >
          {/* Wave 1 — deepest, slightly more opaque */}
          <path
            d="M0 44 C55 28 110 58 180 42 C250 26 320 56 400 38 L400 72 L0 72 Z"
            fill="rgba(215,225,255,0.42)"
          />
          {/* Wave 2 — mid layer */}
          <path
            d="M0 52 C65 38 125 64 200 52 C275 40 345 62 400 50 L400 72 L0 72 Z"
            fill="rgba(205,218,255,0.30)"
          />
          {/* Wave 3 — topmost, most subtle */}
          <path
            d="M0 60 C75 48 145 68 220 60 C295 52 355 68 400 60 L400 72 L0 72 Z"
            fill="rgba(195,212,252,0.20)"
          />
        </svg>
      </div>
    </button>
  )
}
