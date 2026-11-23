import { useId, useState } from "react";
import type {
  DiabetesType,
  UserProfile,
  YesNoUnknown,
} from "../../data/types";
import {
  DIABETES_TYPE_OPTIONS,
} from "../../data/profileConstants";
import { EditorShell } from "../../components/profile/EditorShell";
import type { ProfileSubmitIntent } from "../../data/basicInfoDraft";
import {
  BigSelect,
  ChoiceRows,
  Field,
  FormSectionCard,
  TextInput,
} from "../../components/profile/controls";
import { AnimatedDisclosure } from "../../components/AnimatedDisclosure";

const YESNO: { id: YesNoUnknown; label: string }[] = [
  { id: "yes", label: "是" },
  { id: "no", label: "否" },
  { id: "unknown", label: "不清楚" },
];

const YESNO_BOOL: { id: 'yes' | 'no'; label: string }[] = [
  { id: "yes", label: "是" },
  { id: "no", label: "否" },
];

export function DiabetesEditor({
  profile,
  onBack,
  onSave,
}: {
  profile: UserProfile;
  onBack: () => void;
  onSave: (patch: Partial<UserProfile>) => void;
}) {
  const [type, setType] = useState<DiabetesType | null>(profile.diabetesType);
  const [otherType, setOtherType] = useState(profile.otherDiabetesType || "");
  const [duration, setDuration] = useState(profile.diabetesDurationYears?.toString() ?? "");
  const [durationError, setDurationError] = useState("");
  const durationId = useId();
  const [usesMeds, setUsesMeds] = useState<YesNoUnknown>(
    profile.usesDiabetesMeds,
  );
  const [usesInsulin, setUsesInsulin] = useState<YesNoUnknown>(
    profile.usesInsulin,
  );

  // Risk flags
  const [hasHypoHistory, setHasHypoHistory] = useState<'yes'|'no'>(profile.hasHypoHistory ? 'yes' : 'no');
  const [isFrail, setIsFrail] = useState<'yes'|'no'>(profile.isFrail ? 'yes' : 'no');
  const [hasHypoUnawareness, setHasHypoUnawareness] = useState<'yes'|'no'>(profile.hasHypoUnawareness ? 'yes' : 'no');
  const [healthLiteracy, setHealthLiteracy] = useState<'HIGH'|'MEDIUM'|'LOW'>(profile.healthLiteracy || 'MEDIUM');

  const save = (intent: ProfileSubmitIntent = 'save') => {
    const years = duration.trim() === "" ? null : Number(duration);
    const invalid = years !== null && (!Number.isFinite(years) || years < 0 || years > 120);
    if (invalid && (intent === 'save' || intent === 'next')) {
      setDurationError("請填寫 0–120 年的有效數字，或留空。");
      document.getElementById(durationId)?.focus({preventScroll:true});
      return;
    }
    setDurationError("");
    onSave({
      diabetesType: type,
      otherDiabetesType: otherType.trim(),
      ...(!invalid ? { diabetesDurationYears: years } : {}),
      usesDiabetesMeds: usesMeds,
      usesInsulin,
      // Risk flags
      hasHypoHistory: hasHypoHistory === 'yes',
      isFrail: isFrail === 'yes',
      hasHypoUnawareness: hasHypoUnawareness === 'yes',
      healthLiteracy,
    });
  };

  return (
    <EditorShell title="糖尿病相關" onBack={onBack} onSave={save}>
      <FormSectionCard>
        <Field label="糖尿病類型">
          <BigSelect
            value={type ?? ""}
            options={[{id:"",label:"請選擇"}, ...DIABETES_TYPE_OPTIONS]}
            onChange={value => setType((value || null) as DiabetesType | null)}
          />
        </Field>

        {type === "other" && (
          <Field label="其他糖尿病類型">
            <TextInput
              value={otherType}
              onChange={(e) => setOtherType(e.target.value)}
              placeholder="請填寫類型（選填）"
            />
          </Field>
        )}
        <Field label="糖尿病年期（選填）" accessibleLabel="糖尿病年期" hint="不清楚可留空。">
          <TextInput
            id={durationId}
            inputMode="decimal"
            unit="年"
            value={duration}
            onChange={(e) => { setDuration(e.target.value); setDurationError(""); }}
            placeholder="例如 10"
            aria-invalid={!!durationError || undefined}
            aria-describedby={durationError ? `${durationId}-error` : undefined}
          />
          {durationError && <p id={`${durationId}-error`} role="alert" className="profile-field-error">{durationError}</p>}
        </Field>

        <Field label="口服糖尿藥物">
          <ChoiceRows<YesNoUnknown>
            ariaLabel="口服糖尿藥物"
            layout="segments"
            options={YESNO}
            value={usesMeds}
            onChange={setUsesMeds}
          />
        </Field>

        <Field label="注射糖尿治療">
          <ChoiceRows<YesNoUnknown>
            ariaLabel="注射糖尿治療"
            layout="segments"
            options={YESNO}
            value={usesInsulin}
            onChange={setUsesInsulin}
          />
        </Field>
      </FormSectionCard>

      <AnimatedDisclosure title="進階風險評估（選填）">
        <FormSectionCard>
          <p className="profile-help">以下問題幫助系統為你提供更安全的建議。如果不確定，可以先跳過。</p>

          <Field label="你是否曾經有低血糖發作？" accessibleLabel="低血糖病史">
            <ChoiceRows<'yes'|'no'>
              ariaLabel="低血糖病史"
              layout="segments"
              options={YESNO_BOOL}
              value={hasHypoHistory}
              onChange={setHasHypoHistory}
            />
          </Field>

          <Field label="醫生是否提過你屬於體弱或需要特殊照顧？" accessibleLabel="體弱標誌">
            <ChoiceRows<'yes'|'no'>
              ariaLabel="體弱標誌"
              layout="segments"
              options={YESNO_BOOL}
              value={isFrail}
              onChange={setIsFrail}
            />
          </Field>

          <Field label="你低血糖發作時是否通常冇預警症狀（如手震、出汗）？" accessibleLabel="無感低血糖">
            <ChoiceRows<'yes'|'no'>
              ariaLabel="無感低血糖"
              layout="segments"
              options={YESNO_BOOL}
              value={hasHypoUnawareness}
              onChange={setHasHypoUnawareness}
            />
          </Field>

          <Field label="你覺得自己閱讀健康資料嘅能力如何？" accessibleLabel="健康素養">
            <ChoiceRows<'HIGH'|'MEDIUM'|'LOW'>
              ariaLabel="健康素養"
              layout="segments"
              options={[
                { id: "HIGH", label: "好容易睇明" },
                { id: "MEDIUM", label: "一般" },
                { id: "LOW", label: "有啲困難" },
              ]}
              value={healthLiteracy}
              onChange={setHealthLiteracy}
            />
          </Field>
        </FormSectionCard>
      </AnimatedDisclosure>

    </EditorShell>
  );
}