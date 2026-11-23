import { useState } from "react";
import type { UserProfile } from "../../data/types";
import {
  COMMON_CONDITIONS,
  OTHER_CONDITIONS,
} from "../../data/profileConstants";
import { EditorShell } from "../../components/profile/EditorShell";
import {
  ChipMultiSelect,
  Field,
  FormSectionCard,
  TextInput,
} from "../../components/profile/controls";
import { ChevronDownIcon } from "../../components/icons";

export function ConditionsEditor({
  profile,
  onBack,
  onSave,
}: {
  profile: UserProfile;
  onBack: () => void;
  onSave: (patch: Partial<UserProfile>) => void;
}) {
  const [none, setNone] = useState(profile.noChronicConditions);
  const [conditions, setConditions] = useState<string[]>(profile.conditions);
  const [details, setDetails] = useState(profile.conditionDetails || {});
  const [otherNote, setOtherNote] = useState(profile.otherConditionNote);

  // 「沒有長期疾病」與疾病多選互斥
  const toggleNone = () => {
    setNone((v) => {
      const next = !v;
      if (next) setConditions([]);
      return next;
    });
  };
  const toggleCondition = (c: string) => {
    setNone(false);
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const save = () =>
    onSave({
      noChronicConditions: none,
      conditions: none ? [] : conditions,
      otherConditionNote: none ? "" : otherNote.trim(),
      conditionDetails: Object.fromEntries(
        (none ? [] : conditions).map((c) => [c, details[c] || {}]),
      ),
    });

  return (
    <EditorShell title="長期疾病" onBack={onBack} onSave={save}>
      <p className="profile-help">
        除糖尿病以外，您是否有其他長期疾病？可多選。
      </p>

      <ChipMultiSelect
        ariaLabel="沒有長期疾病"
        options={["沒有長期疾病"]}
        selected={none ? ["沒有長期疾病"] : []}
        onToggle={toggleNone}
      />

      <FormSectionCard>
        <Field label="常見疾病">
          <ChipMultiSelect
            ariaLabel="常見長期疾病"
            options={COMMON_CONDITIONS}
            selected={conditions}
            onToggle={toggleCondition}
          />
        </Field>

        <Field label="其他疾病">
          <ChipMultiSelect
            ariaLabel="其他長期疾病"
            options={OTHER_CONDITIONS}
            selected={conditions}
            onToggle={toggleCondition}
          />
        </Field>

        <Field label="其他名稱" hint="如上面沒有列出，可自行填寫。">
          <TextInput
            value={otherNote}
            onChange={(e) => setOtherNote(e.target.value)}
            onFocus={() => setNone(false)}
            placeholder="例如：慢性阻塞性肺病"
          />
        </Field>
      </FormSectionCard>
      {!none && conditions.length > 0 && (
        <FormSectionCard title="已選疾病詳情">
          <p className="t-support text-ink-soft">
            病齡及補充資料均可稍後填寫。
          </p>
          {conditions.map((condition, index) => (
            <details
              key={condition}
              open={index === 0}
              className="profile-condition-details"
            >
              <summary className="profile-condition-summary">
                <span>{condition}</span>
                <ChevronDownIcon width={20} height={20} aria-hidden="true" />
              </summary>
              <div className="profile-condition-fields">
                <Field
                  label="患病年數"
                  accessibleLabel={`${condition}患病年數`}
                  hint="未滿一年可填小數，例如 0.5。"
                >
                  <TextInput
                    inputMode="decimal"
                    placeholder="例如 5 年"
                    value={details[condition]?.years || ""}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        [condition]: {
                          ...prev[condition],
                          years: e.target.value.replace(/[^0-9.]/g, ""),
                        },
                      }))
                    }
                  />
                </Field>
                <Field
                  label="補充資料"
                  accessibleLabel={`${condition}補充詳情`}
                >
                  <TextInput
                    placeholder="例如疾病名稱、目前情況（選填）"
                    value={details[condition]?.specificName || ""}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        [condition]: {
                          ...prev[condition],
                          specificName: e.target.value,
                        },
                      }))
                    }
                  />
                </Field>
              </div>
            </details>
          ))}
        </FormSectionCard>
      )}
    </EditorShell>
  );
}
