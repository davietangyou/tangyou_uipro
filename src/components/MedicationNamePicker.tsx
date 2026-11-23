import { useId, useRef, useState } from "react";
import { DeviceModal } from "./DeviceModal";
import { medicationCatalog, medicationCatalogIndex, medicationCandidateValue } from "../data/medicationCatalog";
import { VirtualWheelColumn } from "./RecordDateTimePicker";
import { MedicationPhotoPicker } from "./MedicationPhotoPicker";
import { ChevronDownIcon } from "./icons";

// Reuse the legacy prototype's names only; selecting a name never supplies a dose.
const medications = medicationCatalog.map(entry => entry.label);
const items = [{ id: "-1", label: "請選擇藥物" }, ...medications.map((label, index) => ({ id: String(index), label }))];

export function MedicationNamePicker({
  value,
  onConfirm,
}: {
  value: string;
  onConfirm: (name: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [candidate, setCandidate] = useState("-1");
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState("");
  const [rowHeight, setRowHeight] = useState(100);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
  };

  const toggleManual = () => {
    setManual(!manual);
    setError("");
    if (!manual)
      requestAnimationFrame(() =>
        input.current?.focus({ preventScroll: true }),
      );
  };

  return (
    <>
      <div className="care-field">
        <span id={`${id}-label`}>藥物名稱</span>
        <button
          ref={trigger}
          type="button"
          className="med-unit-trigger med-name-trigger"
          aria-labelledby={`${id}-label ${id}-value`}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-voice-avoid
          onClick={() => {
            const selected = medicationCatalogIndex(value);
            setCandidate(String(selected));
            setManual(!!value && selected === -1);
            setCustomName(value);
            setError("");
            setRowHeight(
              document.documentElement.classList.contains("large-font")
                ? 132
                : 100,
            );
            setOpen(true);
          }}
        >
          <span
            id={`${id}-value`}
            className={!value ? "med-name-placeholder" : undefined}
          >
            {value || "輸入藥物名稱"}
          </span>
          <ChevronDownIcon width={21} height={21} />
        </button>
      </div>
      <DeviceModal open={open} onClose={close} returnFocusRef={trigger} label={`${id}-title`} className="med-name-sheet">
              <div className="med-name-content">
                <div className="med-name-header" data-voice-avoid>
                  <button type="button" onClick={close}>
                    取消
                  </button>
                  <h2 id={`${id}-title`}>
                    {manual ? "自行輸入藥物" : "選擇藥物"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      const name = manual
                        ? customName.trim()
                        : medicationCandidateValue(value, Number(candidate));
                      if (!name) {
                        setError(manual ? "請填寫藥物名稱。" : "請先選擇藥物，或自行輸入。");
                        input.current?.focus({preventScroll:true});
                        return;
                      }
                      onConfirm(name);
                      close();
                    }}
                  >
                    完成
                  </button>
                </div>
                {manual ? (
                  <div className="care-field med-name-custom" data-voice-avoid>
                    <span>藥物名稱</span>
                    <div className="med-name-input-row">
                      <input
                        ref={input}
                        aria-label="藥物名稱"
                        value={customName}
                        maxLength={200}
                        autoComplete="off"
                        placeholder="輸入藥物名稱"
                        aria-invalid={!!error}
                        aria-describedby={error ? `${id}-error` : undefined}
                        onChange={(event) => {
                          setCustomName(event.target.value);
                          setError("");
                        }}
                      />
                      <MedicationPhotoPicker
                        onSelect={(name) => {
                          setCustomName(name);
                          setError("");
                        }}
                      />
                    </div>
                    {error && (
                      <span
                        id={`${id}-error`}
                        role="alert"
                        className="med-name-error"
                      >
                        {error}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="med-name-wheel" data-voice-avoid>
                    <VirtualWheelColumn
                      items={items}
                      selectedId={candidate}
                      onSelect={setCandidate}
                      instanceKey={0}
                      label="藥物名單"
                      itemHeight={rowHeight}
                      visibleItems={3}
                    />
                  </div>
                )}
                {!manual && error && <p role="alert" className="med-name-error">{error}</p>}
                <button
                  type="button"
                  className={`med-name-mode${manual ? "" : " med-name-manual-entry"}`}
                  onClick={toggleManual}
                  data-voice-avoid
                >
                  {manual ? "返回藥物名單" : "找不到藥物？自行輸入"}
                </button>
              </div>
      </DeviceModal>

    </>
  );
}
