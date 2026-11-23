import { useEffect, useId, useState } from "react";
import type { Sex, UserProfile, WeightUnit } from "../../data/types";
import {
  bmiCategory,
  computeBmi,
  SEX_OPTIONS,
  toKg,
} from "../../data/profileConstants";
import { EditorShell } from "../../components/profile/EditorShell";
import {
  Field,
  FormSectionCard,
  TextInput,
  ChoiceRows,
} from "../../components/profile/controls";

import {basicInfoSubmission, type BasicInfoErrors, type ProfileSubmitIntent} from "../../data/basicInfoDraft";

const BMI_TONE: Record<string, string> = {
  low: "text-warning",
  ideal: "text-ok-text",
  high: "text-warning",
  danger: "text-danger",
};

export function BasicInfoEditor({
  profile,
  onBack,
  onSave,
}: {
  profile: UserProfile;
  onBack: () => void;
  onSave: (patch: Partial<UserProfile>) => void;
}) {
  const [errors, setErrors] = useState<BasicInfoErrors>({});
  const fieldId=useId();
  useEffect(()=>{
    const first=Object.keys(errors)[0];
    if(first){const input=document.getElementById(`${fieldId}-${first}`);input?.focus({preventScroll:true});}
  },[errors,fieldId]);
  const [name, setName] = useState(profile.name);
  const [age, setAge] = useState(profile.age?.toString() ?? "");
  const [sex, setSex] = useState<Sex | null>(profile.sex);
  const [heightCm, setHeightCm] = useState(profile.heightCm?.toString() ?? "");
  const [weight, setWeight] = useState(profile.weight?.toString() ?? "");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile.weightUnit);

  const ageNum = age.trim() === "" ? null : Number(age);
  const heightNum = heightCm.trim() === "" ? null : Number(heightCm);
  const weightNum = weight.trim() === "" ? null : Number(weight);
  const bmi = computeBmi(heightNum, toKg(weightNum, weightUnit));
  const cat = bmiCategory(bmi, ageNum);

  const save = (intent:ProfileSubmitIntent='save') => {
    const result=basicInfoSubmission({name,age,sex,heightCm,weight,weightUnit},intent);
    if(result.blocked){setErrors(result.errors);return;}
    setErrors({});onSave(result.patch);
  };

  return (
    <EditorShell title="基本資料" onBack={onBack} onSave={save}>
      <FormSectionCard>
        <Field label="稱呼">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="想我們怎樣稱呼您？"
            maxLength={20}
          />
        </Field>

        <Field label="年齡">
          <TextInput
            inputMode="numeric"
            unit="歲"
            id={`${fieldId}-age`}
            aria-invalid={!!errors.age || undefined}
            aria-describedby={errors.age?`${fieldId}-age-error`:undefined}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="例如 68"
          />
          {errors.age&&<p id={`${fieldId}-age-error`} role="alert" className="profile-field-error">{errors.age}</p>}
        </Field>

        <Field label="性別">
          <ChoiceRows<Sex>
            ariaLabel="選擇性別"
            layout="segments"
            value={(sex ?? "") as Sex}
            onChange={setSex}
            options={SEX_OPTIONS}
          />
        </Field>

        <Field label="身高">
          <TextInput
            inputMode="decimal"
            unit="cm"
            id={`${fieldId}-heightCm`}
            aria-invalid={!!errors.heightCm || undefined}
            aria-describedby={errors.heightCm?`${fieldId}-heightCm-error`:undefined}
            value={heightCm}
            onChange={(e) =>
              setHeightCm(e.target.value)
            }
            placeholder="例如 168"
          />
          {errors.heightCm&&<p id={`${fieldId}-heightCm-error`} role="alert" className="profile-field-error">{errors.heightCm}</p>}
        </Field>

        <Field label="體重">
          <div className="profile-weight-row">
            <TextInput
              inputMode="decimal"
              id={`${fieldId}-weight`}
              aria-invalid={!!errors.weight || undefined}
              aria-describedby={errors.weight?`${fieldId}-weight-error`:undefined}
              value={weight}
              onChange={(e) =>
                setWeight(e.target.value)
              }
              placeholder="例如 72"
              className="flex-1"
            />
            <div className="profile-weight-unit">
              <ChoiceRows<WeightUnit>
                ariaLabel="體重單位"
                layout="segments"
                value={weightUnit}
                onChange={setWeightUnit}
                options={[
                  { id: "kg", label: "公斤" },
                  { id: "lb", label: "磅" },
                ]}
              />
            </div>
          </div>
          {errors.weight&&<p id={`${fieldId}-weight-error`} role="alert" className="profile-field-error">{errors.weight}</p>}
        </Field>
      </FormSectionCard>

      {/* BMI 自動計算並依年齡分色 */}
      <div className="profile-bmi">
        <div className="hm-body text-ink-soft">BMI 體重指數</div>
        {bmi != null && cat ? (
          <>
            <div className="profile-bmi-result">
              <span className="profile-bmi-number tnum">{bmi}</span>
              <span className={["profile-bmi-status", BMI_TONE[cat.tone]].join(" ")}>
                {cat.label}
              </span>
            </div>
            <div className="t-support text-ink-soft" style={{marginTop:6}}>
              {cat.description}
            </div>
          </>
        ) : (
          <div className="t-support text-ink-muted">
            填入身高體重後自動計算
          </div>
        )}
        {(ageNum ?? 0) >= 65 && (
          <div className="t-support text-ink-soft">已採用長者參考範圍</div>
        )}
      </div>
    </EditorShell>
  );
}