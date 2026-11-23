import { AnimatedDisclosure } from './AnimatedDisclosure';
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Medication } from "../data/types";
import {
  createMedicationDraft,
  medicationUnits,
  type MedicationUnitCode,
} from "../data/medicationWizard";
import { newId } from "../data/medication";
import { MedicationNamePicker } from "./MedicationNamePicker";
import { UnitWheelSheet } from "./MedicationWizard";
import { ConfirmDialog } from "./ConfirmDialog";
import { BackIcon, ChevronDownIcon, PillIcon } from "./icons";

export function MedicationBasicEditor({
  initial,
  mode = "edit",
  busy,
  saveError,
  onBack,
  onSave,
}: {
  initial: Medication;
  mode?: "create" | "edit";
  busy: boolean;
  saveError: string;
  onBack: () => void;
  onSave: (medication: Medication) => Promise<boolean>;
}) {
  const [med, setMed] = useState(() => structuredClone(initial));
  const [unit, setUnit] = useState(() => {
    const draft = createMedicationDraft(initial);
    return { code: draft.unitCode, custom: draft.customUnit };
  });
  const [unitOpen, setUnitOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const unitTrigger = useRef<HTMLButtonElement>(null);
  const label =
    unit.code === "custom"
      ? unit.custom.trim()
      : medicationUnits.find((item) => item.code === unit.code)?.label || "";
  const changedUnit = !!initial.schedule && label !== initial.schedule.unit;
  const needsReview =
    changedUnit && (!!initial.schedule?.slots.length || !!initial.inventory);
  const dirty = JSON.stringify(med) !== JSON.stringify(initial) || changedUnit;
  useLayoutEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, []);
  const back = () => {
    if (busy || submitting) return;
    if (dirty) setLeaveOpen(true);
    else onBack();
  };
  const closeUnit = () => {
    setUnitOpen(false);
    requestAnimationFrame(() =>
      unitTrigger.current?.focus({ preventScroll: true }),
    );
  };
  const applyUnit = (code: MedicationUnitCode) => {
    setUnit((current) => ({
      code,
      custom: code === "custom" ? current.custom : "",
    }));
    setReviewed(false);
    setError("");
    closeUnit();
  };
  const save = async () => {
    if (busy || submitting) return;
    if (!med.name.trim()) {
      setError("請填寫藥物名稱。");
      return;
    }
    if (initial.schedule && !label) {
      setError("請填寫用量單位。");
      return;
    }
    if (needsReview && !reviewed) {
      setError("請先核對新單位下的用量及庫存數字。");
      return;
    }
    const next = { ...med, name: med.name.trim() };
    if (next.schedule && changedUnit) {
      next.schedule = { ...next.schedule, unit: label, unitCode: unit.code };
      if (next.inventory)
        next.inventory = { ...next.inventory, revision: newId() };
    }
    setError("");
    setSubmitting(true);
    try {
      await onSave(next);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="care-page medication-workflow med-wizard-page med-basic-edit-page">
      <header className="med-wizard-header">
        <button
          type="button"
          className="med-back-button"
          onClick={back}
          data-voice-avoid
        >
          <BackIcon width={24} height={24} />
          <span>返回</span>
        </button>
        <div data-voice-avoid>
          <p>{mode === "create" ? "新增藥物" : "編輯藥物"}</p>
          <h1 ref={heading} tabIndex={-1}>
            藥物資料
          </h1>
        </div>
      </header>
      <section className="med-wizard-context" data-voice-avoid>
        <span aria-hidden="true">
          <PillIcon width={26} height={26} />
        </span>
        <div>
          <strong>{med.name || "尚未命名的藥物"}</strong>
          <small>{label ? `用量單位：${label}` : "填寫藥名即可儲存，提醒可稍後設定"}</small>
        </div>
      </section>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="med-basic-edit-form"
      >
        <section className="med-wizard-card">
          <MedicationNamePicker
            value={med.name}
            onConfirm={(name) => {
              setMed((current) => ({ ...current, name }));
              setError("");
            }}
          />
          {initial.schedule && (
            <div className="care-field" data-voice-avoid>
              <span id="basic-med-unit-label">用量單位</span>
              <button
                ref={unitTrigger}
                type="button"
                className="med-unit-trigger"
                aria-labelledby="basic-med-unit-label basic-med-unit-value"
                aria-haspopup="dialog"
                aria-expanded={unitOpen}
                onClick={() => setUnitOpen(true)}
              >
                <span id="basic-med-unit-value">{label || "尚未設定"}</span>
                <ChevronDownIcon width={21} height={21} />
              </button>
            </div>
          )}
          {initial.schedule && unit.code === "custom" && (
            <label className="care-field" data-voice-avoid>
              自訂用量單位
              <input
                value={unit.custom}
                onChange={(event) => {
                  setUnit({ ...unit, custom: event.target.value });
                  setReviewed(false);
                  setError("");
                }}
              />
            </label>
          )}
          <label className="care-field" data-voice-avoid>
            服用備註（選填）
            <textarea
              rows={3}
              value={med.usage || ""}
              maxLength={300}
              placeholder="例如藥袋上的飯前、飯後說明"
              onChange={(event) =>
                setMed({ ...med, usage: event.target.value })
              }
            />
          </label>
          <AnimatedDisclosure title="規格／劑量說明（選填）">
            <label className="care-field" data-voice-avoid>
              <span>規格／劑量說明</span>
              <input
                value={med.dosage || ""}
                maxLength={200}
                placeholder="按藥袋上的資料填寫"
                onChange={(event) =>
                  setMed({ ...med, dosage: event.target.value })
                }
              />
            </label>
          </AnimatedDisclosure>
          {needsReview && (
            <div className="med-basic-unit-review" data-voice-avoid>
              <p>
                單位由「{initial.schedule?.unit}」改為「{label || "未填寫"}
                」，現有數字不會自動換算。
              </p>
              {!!initial.schedule?.slots.length && (
                <p>
                  每次用量：
                  {initial.schedule.slots
                    .map((s) => `${s.time} · ${s.amount} ${label}`)
                    .join("；")}
                </p>
              )}
              {initial.inventory && (
                <p>
                  庫存：{initial.inventory.quantity} {label}
                  {initial.inventory.threshold != null
                    ? `；補充提醒：${initial.inventory.threshold} ${label}`
                    : ""}
                </p>
              )}
              <label className="care-check">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(event) => {
                    setReviewed(event.target.checked);
                    setError("");
                  }}
                />
                已核對用量及庫存數字
              </label>
            </div>
          )}
        </section>
        {(error || saveError) && (
          <p className="care-warning" role="alert">
            {error || saveError}
          </p>
        )}
        <footer className="med-wizard-actions" data-voice-avoid>
          <button type="button" className="med-wizard-secondary" onClick={back}>
            取消
          </button>
          <button
            type="submit"
            className="med-wizard-primary"
            disabled={busy || submitting}
          >
            {busy || submitting ? "正在儲存…" : mode === "create" ? "儲存藥物" : "儲存修改"}
          </button>
        </footer>
      </form>
      {unitOpen &&
        createPortal(
          <UnitWheelSheet
            open
            value={unit.code}
            onCancel={closeUnit}
            onConfirm={applyUnit}
          />,
          document.getElementById("device-overlay-layer") ?? document.body,
        )}
      <ConfirmDialog
        open={leaveOpen}
        title="放棄未儲存的變更？"
        message="離開後，這次新增或修改的內容不會保留。"
        confirmText="放棄變更"
        onCancel={() => setLeaveOpen(false)}
        onConfirm={onBack}
      />
    </div>
  );
}
