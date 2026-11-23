import { useState } from "react";
import type { ExerciseFreq, UserProfile } from "../../data/types";
import {
  DIET_HABITS,
  EXERCISE_DURATION_OPTIONS,
  EXERCISE_TYPES,
} from "../../data/profileConstants";
import {
  activitySummary,
  dietSummary,
  lifestylePatch,
} from "../../data/lifestyle";
import { EditorShell } from "../../components/profile/EditorShell";
import {
  CardMultiSelect,
  ChoiceRows,
  Field,
  TextArea,
} from "../../components/profile/controls";
import { Activity as PulseIcon, Utensils as ForkKnifeIcon } from "lucide-react";
import { ChevronDownIcon } from "../../components/icons";

const COMMON_ACTIVITIES = ["WALK", "TAICHI", "STRETCH"];
const FREQUENCIES: { id: ExerciseFreq; label: string }[] = [
  { id: "0", label: "暫時沒有" },
  { id: "1-2", label: "1–2 天" },
  { id: "3-4", label: "3–4 天" },
  { id: "5+", label: "5 天或以上" },
];
export function DietExerciseEditor({
  profile,
  onBack,
  onSave,
}: {
  profile: UserProfile;
  onBack: () => void;
  onSave: (patch: Partial<UserProfile>) => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [open, setOpen] = useState<"diet" | "activity" | null>("diet");
  const [error, setError] = useState("");
  const patch = (next: Partial<UserProfile>) =>
    setDraft((previous) => ({ ...previous, ...next }));
  const toggle = (key: "dietHabits" | "exerciseTypes", id: string) =>
    setDraft((previous) => ({
      ...previous,
      [key]: previous[key].includes(id)
        ? previous[key].filter((item) => item !== id)
        : [...previous[key], id],
    }));
  const noActivity = !draft.exerciseFreq || draft.exerciseFreq === "0";
  const save = () => {
    try {
      onSave(lifestylePatch(draft));
    } catch {
      setError("未能儲存，填寫內容已保留。請稍後再試。");
    }
  };
  const durationOptions = EXERCISE_DURATION_OPTIONS.map((option) => ({
    id: String(option.minutes),
    label: option.label,
  }));
  if (
    draft.exerciseMinutes &&
    !durationOptions.some(
      (option) => option.id === String(draft.exerciseMinutes),
    )
  ) {
    durationOptions.push({
      id: String(draft.exerciseMinutes),
      label: `約 ${draft.exerciseMinutes} 分鐘（原有紀錄）`,
    });
  }
  const recap = noActivity
    ? activitySummary(draft)
    : `每週活動：${FREQUENCIES.find((option) => option.id === draft.exerciseFreq)?.label ?? draft.exerciseFreq}${draft.exerciseMinutes ? `・每次${durationOptions.find((option) => option.id === String(draft.exerciseMinutes))?.label ?? ""}` : ""}`;
  return (
    <EditorShell title="飲食與運動" onBack={onBack} onSave={save}>
      <div className="lifestyle-editor">
        <p className="profile-help lifestyle-intro">
          簡單記下日常習慣，之後也可以修改。
        </p>
        <section className="lifestyle-section lifestyle-diet">
          <h2>
            <button
              className="lifestyle-toggle"
              aria-expanded={open === "diet"}
              aria-controls="lifestyle-diet-panel"
              onClick={() => setOpen(open === "diet" ? null : "diet")}
            >
              <ForkKnifeIcon width={24} height={24} aria-hidden="true" />
              <span>平時怎樣吃</span>
              <ChevronDownIcon width={20} height={20} aria-hidden="true" />
            </button>
          </h2>
          {open !== "diet" && (
            <p className="lifestyle-summary">
              {draft.dietHabits.length ? dietSummary(draft) : "未填寫"}
            </p>
          )}
          <div
            id="lifestyle-diet-panel"
            hidden={open !== "diet"}
            className="lifestyle-panel"
          >
            <Field label="哪些較像您的習慣？可多選">
              <CardMultiSelect
                ariaLabel="飲食習慣"
                options={DIET_HABITS}
                selected={draft.dietHabits}
                onToggle={(id) => toggle("dietHabits", id)}
              />
            </Field>
            <details className="lifestyle-details">
              <summary>
                補充喜歡的食物（選填）
                {draft.favoriteFoods.trim() && (
                  <span className="profile-help">已填寫</span>
                )}
                <ChevronDownIcon width={20} height={20} aria-hidden="true" />
              </summary>
              <Field label="喜歡吃甚麼？">
                <TextArea
                  value={draft.favoriteFoods}
                  onChange={(event) =>
                    patch({ favoriteFoods: event.target.value })
                  }
                  placeholder="例如：蒸魚、雲吞麵、奶茶"
                />
              </Field>
            </details>
            <button
              className="lifestyle-next"
              onClick={() => {
                setOpen("activity");
                document
                  .querySelector(".profile-editor-scroll")
                  ?.scrollTo({ top: 0 });
              }}
            >
              接著看看活動習慣
            </button>
          </div>
        </section>
        <section className="lifestyle-section lifestyle-activity">
          <h2>
            <button
              className="lifestyle-toggle"
              aria-expanded={open === "activity"}
              aria-controls="lifestyle-activity-panel"
              onClick={() => setOpen(open === "activity" ? null : "activity")}
            >
              <PulseIcon width={24} height={24} aria-hidden="true" />
              <span>平時有沒有運動</span>
              <ChevronDownIcon width={20} height={20} aria-hidden="true" />
            </button>
          </h2>
          {open !== "activity" && (
            <p className="lifestyle-summary">
              {draft.exerciseFreq == null ? "未填寫" : activitySummary(draft)}
            </p>
          )}
          <div
            id="lifestyle-activity-panel"
            hidden={open !== "activity"}
            className="lifestyle-panel"
          >
            <Field label="每週活動幾天？">
              <ChoiceRows
                ariaLabel="每週活動幾天"
                options={FREQUENCIES}
                value={draft.exerciseFreq}
                onChange={(exerciseFreq) => patch({ exerciseFreq })}
                layout="segments"
              />
            </Field>
            {draft.exerciseFreq === "0" && (
              <p className="profile-help">
                已記下，暫時不用填寫下面的活動詳情。
              </p>
            )}
            {!noActivity && (
              <>
                <Field label="每次大約多久？">
                  <ChoiceRows
                    ariaLabel="每次活動時間"
                    options={durationOptions}
                    value={
                      draft.exerciseMinutes
                        ? String(draft.exerciseMinutes)
                        : null
                    }
                    onChange={(value) =>
                      patch({ exerciseMinutes: Number(value) })
                    }
                    layout="segments"
                  />
                </Field>
                <Field label="通常做甚麼？（可多選）">
                  <CardMultiSelect
                    ariaLabel="常見活動"
                    options={EXERCISE_TYPES.filter((item) =>
                      COMMON_ACTIVITIES.includes(item.id),
                    )}
                    selected={draft.exerciseTypes}
                    onToggle={(id) => toggle("exerciseTypes", id)}
                  />
                </Field>
                <details className="lifestyle-details">
                  <summary>
                    更多活動
                    {draft.exerciseTypes.some(
                      (id) => !COMMON_ACTIVITIES.includes(id),
                    ) && <span className="profile-help">有已選項目</span>}
                    <ChevronDownIcon
                      width={20}
                      height={20}
                      aria-hidden="true"
                    />
                  </summary>
                  <CardMultiSelect
                    ariaLabel="更多活動"
                    options={EXERCISE_TYPES.filter(
                      (item) => !COMMON_ACTIVITIES.includes(item.id),
                    )}
                    selected={draft.exerciseTypes}
                    onToggle={(id) => toggle("exerciseTypes", id)}
                  />
                  {draft.exerciseTypes.includes("OTHER") && (
                    <Field label="其他活動">
                      <TextArea
                        value={draft.otherExerciseNote}
                        onChange={(event) =>
                          patch({ otherExerciseNote: event.target.value })
                        }
                        placeholder="例如：乒乓球、跳舞"
                      />
                    </Field>
                  )}
                </details>
              </>
            )}
            <p className="lifestyle-recap">{recap}</p>
          </div>
        </section>
        {error && (
          <p role="alert" className="record-error">
            {error}
          </p>
        )}
      </div>
    </EditorShell>
  );
}
