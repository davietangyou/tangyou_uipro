import { useState } from "react";
import type { UserProfile } from "../../data/types";
import { EditorShell } from "../../components/profile/EditorShell";
import { ChoiceRows, FormSectionCard } from "../../components/profile/controls";

type CareChoice = "caregiver" | "alone";

export function CareEditor({
  profile,
  onBack,
  onSave,
}: {
  profile: UserProfile;
  onBack: () => void;
  onSave: (patch: Partial<UserProfile>) => void;
}) {
  const initial: CareChoice | null = profile.hasCaregiver
    ? "caregiver"
    : profile.livesAlone
      ? "alone"
      : null;
  const [choice, setChoice] = useState<CareChoice | null>(initial);

  const save = () =>
    onSave({
      hasCaregiver: choice === "caregiver",
      livesAlone: choice === "alone",
    });

  return (
    <EditorShell title="家庭照顧支持" onBack={onBack} onSave={save}>
      <FormSectionCard>
        <p className="profile-help">
          日常生活中，您的照顧支持情況是？此資料協助我們給出更貼合的健康提示。
        </p>
        <ChoiceRows<CareChoice>
          ariaLabel="家庭照顧支持"
          options={[
            { id: "caregiver", label: "有家人 / 照顧者協助" },
            { id: "alone", label: "獨自照顧自己" },
          ]}
          value={choice}
          onChange={setChoice}
        />
      </FormSectionCard>
    </EditorShell>
  );
}
