import type { ChangeEventHandler, ReactNode } from "react";

const ARC_CENTER_X = 139;
const ARC_CENTER_Y = 139;
const ARC_RADIUS = 139;
const ARC_STROKE = 22;

function arcPoint(value: number, maximum: number) {
  const progress = Math.max(0, Math.min(1, value / maximum));
  const angle = Math.PI * (1 - progress);
  return {
    x: ARC_CENTER_X + ARC_RADIUS * Math.cos(angle),
    y: ARC_CENTER_Y - ARC_RADIUS * Math.sin(angle),
  };
}

function arcPath(from: number, to: number, maximum: number) {
  const start = arcPoint(from, maximum);
  const end = arcPoint(to, maximum);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function SemicircleValueGauge({
  value,
  numericValue,
  hasValue,
  maximum,
  inputMaximum,
  unit,
  ariaLabel,
  arcColor,
  valueColor,
  error,
  feedback,
  onChange,
}: {
  value: string;
  numericValue: number;
  hasValue: boolean;
  maximum: number;
  inputMaximum: number;
  unit: string;
  ariaLabel: string;
  arcColor: string;
  valueColor: string;
  error?: string | null;
  feedback?: ReactNode;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  const endpoint = arcPoint(hasValue ? Math.min(numericValue, maximum) : 0.001, maximum);

  return (
    <div className="record-value-gauge flex flex-col items-center bg-surface">
      <div className="record-value-gauge-dial relative mx-auto" style={{ width: "100%", aspectRatio: "326 / 250" }}>
        <svg viewBox="0 0 326 250" width="100%" height="100%" aria-hidden="true"><svg x="24" y="25" width="278" height="139" viewBox="-12 -12 302 163" preserveAspectRatio="none">
          <path d={arcPath(0, maximum, maximum)} fill="none" stroke="#E6EAE1" strokeWidth={ARC_STROKE} strokeLinecap="round" />
          {hasValue && (
            <path d={arcPath(0, Math.min(numericValue, maximum), maximum)} fill="none" stroke={arcColor} strokeWidth={ARC_STROKE} strokeLinecap="round" />
          )}
          {hasValue && <circle cx={endpoint.x} cy={endpoint.y} r={9} fill={arcColor} />}
        </svg></svg>
        <div className="record-value-gauge-input pointer-events-none absolute flex flex-col items-center" style={{ left: "50%", transform: "translateX(-50%)", top: "35.2%", width: 152 }}>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            max={inputMaximum}
            placeholder="—"
            value={value}
            onChange={onChange}
            aria-label={ariaLabel}
            aria-invalid={!!error}
            className="hm-glucose tnum pointer-events-auto w-[150px] max-w-[150px] appearance-none border-0 bg-transparent text-center outline-none ring-0 placeholder:text-ink-muted/35 [-moz-appearance:textfield] [-webkit-tap-highlight-color:transparent] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
            style={{ color: error ? "var(--color-danger)" : valueColor, fontSize: 48, fontWeight: 700, lineHeight: "72px", height: 72 }}
          />
          <span className="hm-body text-ink-soft" style={{ marginTop: -10, fontSize: 20, lineHeight: "30px", fontWeight: 400 }}>{unit}</span>
        </div>
        <div className="record-value-gauge-scale absolute flex justify-between" style={{left:"8%",right:"8%",top:"81.6%",fontSize:16,lineHeight:"24px"}} aria-label={`儀表顯示刻度 0 至 ${maximum}${unit}`}>
          <span className="text-ink-muted">0</span><span className="text-ink-muted">{maximum}</span>
        </div>
      </div>
      {feedback}
    </div>
  );
}
