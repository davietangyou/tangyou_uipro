import {
  createContext,
  useContext,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { DeviceModal } from "../DeviceModal";
import { CheckIcon, ChevronDownIcon } from "../icons";
const FieldLabel = createContext<string | undefined>(undefined);
export function Field({
  label,
  hint,
  meta,
  accessibleLabel,
  children,
}: {
  label: string;
  hint?: string;
  meta?: string;
  accessibleLabel?: string;
  children: ReactNode;
}) {
  return (
    <FieldLabel.Provider value={accessibleLabel || label}>
      <div
        role="group"
        aria-label={accessibleLabel || label}
        className="profile-field"
      >
        <div className="profile-field-heading">
          <span className="profile-label">{label}</span>
          {meta && <span className="profile-help">{meta}</span>}
        </div>
        {children}
        {hint && <span className="profile-help">{hint}</span>}
      </div>
    </FieldLabel.Provider>
  );
}
export function FormSectionCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="profile-section">
      {title && <h2 className="profile-section-title">{title}</h2>}
      {children}
    </section>
  );
}
export function TextInput({
  unit,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { unit?: string }) {
  const label = useContext(FieldLabel);
  const input = (
    <input
      {...props}
      aria-label={props["aria-label"] ?? (unit ? `${label}（${unit}）` : label)}
      className={`profile-input ${props.className || ""}`}
    />
  );
  return unit ? (
    <div className="profile-input-unit">
      {input}
      <span aria-hidden="true">{unit}</span>
    </div>
  ) : (
    input
  );
}
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const label = useContext(FieldLabel);
  return (
    <textarea
      rows={2}
      {...props}
      aria-label={props["aria-label"] ?? label}
      className={`profile-input profile-textarea ${props.className || ""}`}
    />
  );
}
export function BigSelect({ options, value, onChange }: {
  options: {id: string; label: string}[];
  value: string;
  onChange: (value: string) => void;
}) {
  const label = useContext(FieldLabel) ?? "選擇";
  const titleId = useId();
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="profile-input profile-select-display" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span>{options.find(option => option.id === value)?.label ?? "請選擇"}</span>
      <ChevronDownIcon width={20} height={20} aria-hidden="true" />
    </button>
    <DeviceModal open={open} onClose={() => setOpen(false)} label={titleId} className="profile-scope profile-option-dialog" placement="center">
      <h2 id={titleId} className="profile-section-title">{label}</h2>
      <ChoiceRows ariaLabel={label} options={options} value={value} onChange={next => { onChange(next); setOpen(false); }} />
      <button type="button" className="profile-setup-later" onClick={() => setOpen(false)}>取消</button>
    </DeviceModal>
  </>;
}
type Option = { id: string; label: string; description?: string };
export function CardMultiSelect({
  options,
  selected,
  onToggle,
  ariaLabel,
}: {
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="profile-choice-list">
      {options.map((opt) => (
        <label key={opt.id} className="profile-choice profile-checkbox">
          <input
            type="checkbox"
            checked={selected.includes(opt.id)}
            onChange={() => onToggle(opt.id)}
            aria-label={
              opt.description ? `${opt.label}，${opt.description}` : opt.label
            }
          />
          <span className="profile-choice-mark" aria-hidden="true">
            <CheckIcon width={16} height={16} />
          </span>
          <span className="profile-option-copy">
            <span>{opt.label}</span>
            {opt.description && (
              <span className="profile-help">{opt.description}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
export function ChipMultiSelect({
  options,
  selected,
  onToggle,
  ariaLabel,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="profile-chip-list">
      {options.map((opt) => (
        <label
          key={opt}
          className="profile-choice profile-checkbox profile-chip"
        >
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => onToggle(opt)}
            aria-label={opt}
          />
          <span className="profile-choice-mark" aria-hidden="true">
            <CheckIcon width={16} height={16} />
          </span>
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}
export function ChoiceRows<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  layout = "rows",
}: {
  options: { id: T; label: string }[];
  value: T | null;
  onChange: (id: T) => void;
  ariaLabel: string;
  layout?: "rows" | "segments";
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={
        layout === "segments" ? "profile-segments" : "profile-choice-list"
      }
    >
      {options.map((opt) => (
        <label key={opt.id} className="profile-choice profile-radio">
          <input
            type="radio"
            name={name}
            checked={value === opt.id}
            onChange={() => onChange(opt.id)}
            aria-label={opt.label}
          />
          <span>{opt.label}</span>
          <span className="profile-choice-mark" aria-hidden="true">
            <CheckIcon width={16} height={16} />
          </span>
        </label>
      ))}
    </div>
  );
}
