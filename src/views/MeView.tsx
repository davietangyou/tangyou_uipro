import { SavedFeedback } from '../components/SavedFeedback';
import { SEX_OPTIONS, DIABETES_TYPE_OPTIONS } from '../data/profileConstants';
import { lifestyleComplete } from '../data/lifestyle';
import { useContext, useState } from "react";
import { AnimatePresence } from 'motion/react';
import { AccountSettingsContext } from "../components/account/AccountSettingsContext";
import type { ReactNode } from "react";
import type { UserProfile } from "../data/types";
import { DangerButton } from "../components/buttons";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  TriangleAlert as AlertIcon,
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
  Utensils as ForkKnifeIcon,
  Pill as PillIcon,
  Info as InfoIcon,
  Trash2 as TrashIcon,
  UserRound as UserIcon,
  UsersRound as UsersIcon,
} from "lucide-react";
import { BasicInfoEditor } from "./profile/BasicInfoEditor";
import { DiabetesEditor } from "./profile/DiabetesEditor";
import { ConditionsEditor } from "./profile/ConditionsEditor";
import { CareEditor } from "./profile/CareEditor";
import { DietExerciseEditor } from "./profile/DietExerciseEditor";

type SectionId = "basic" | "diabetes" | "conditions" | "care" | "diet";

// 各分區完成度判斷（用於「已完成 X／5」與摘要平和語氣）。
function isComplete(p: UserProfile, id: SectionId): boolean {
  switch (id) {
    case "basic":
      return (
        p.name.trim() !== "" &&
        p.age != null &&
        p.sex != null &&
        p.heightCm != null &&
        p.weight != null
      );
    case "diabetes":
      return p.diabetesType != null && p.usesDiabetesMeds !== "unknown";
    case "conditions":
      return p.noChronicConditions || p.conditions.length > 0;
    case "care":
      return p.hasCaregiver || p.livesAlone;
    case "diet":
      return lifestyleComplete(p);
  }
}

const SECTIONS: {
  id: SectionId;
  title: string;
  icon: (p: { width: number; height: number }) => ReactNode;
  tint: string;
}[] = [
  {
    id: "basic",
    title: "基本資料",
    icon: UserIcon,
    tint: "profile-tint-green",
  },
  {
    id: "diabetes",
    title: "糖尿病相關",
    icon: PillIcon,
    tint: "profile-tint-blue",
  },
  {
    id: "conditions",
    title: "長期疾病",
    icon: AlertIcon,
    tint: "profile-tint-yellow",
  },
  {
    id: "care",
    title: "家庭照顧支持",
    icon: UsersIcon,
    tint: "profile-tint-purple",
  },
  {
    id: "diet",
    title: "飲食與運動",
    icon: ForkKnifeIcon,
    tint: "profile-tint-green",
  },
];

function sectionSummary(p: UserProfile, id: SectionId): string {
  switch (id) {
    case "basic": return [p.age == null ? null : `${p.age} 歲`, SEX_OPTIONS.find(o => o.id === p.sex)?.label, p.heightCm == null ? null : `身高 ${p.heightCm} cm`].filter(Boolean).join("・") || "待填寫";
    case "diabetes": return [DIABETES_TYPE_OPTIONS.find(o => o.id === p.diabetesType)?.label, p.diabetesDurationYears == null ? null : `年期 ${p.diabetesDurationYears} 年`].filter(Boolean).join("・") || "待填寫";
    case "conditions": return p.noChronicConditions ? "沒有長期疾病" : p.conditions.join("、") || "待填寫";
    case "care": return p.hasCaregiver ? "有家人 / 照顧者協助" : p.livesAlone ? "獨自照顧自己" : "待填寫";
    case "diet": return lifestyleComplete(p) ? "已記錄飲食與活動習慣" : "待填寫";
  }
}

export function MeView({
  profile,
  onSaveSection,
  onResetAll,
  onResumeSetup,
  onToast,
  onOpenMedication,
  onOpenAbout,
}: {
  profile: UserProfile;
  onSaveSection: (patch: Partial<UserProfile>) => void;
  onResetAll: () => void;
  onResumeSetup?: () => void;
  onToast: (msg: string) => void;
  onOpenMedication: () => void;
  onOpenAbout: () => void;
}) {
  const [editing, setEditing] = useState<SectionId | null>(null);
  const [savedSection, setSavedSection] = useState<SectionId | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const accountSettings = useContext(AccountSettingsContext);

  const doneCount = SECTIONS.filter((s) => isComplete(profile, s.id)).length;
  const allDone = doneCount === SECTIONS.length;

  const save = (patch: Partial<UserProfile>) => {
    onSaveSection(patch);
    setSavedSection(editing);
    setEditing(null);
    onToast("已成功保存修改");
  };

  const editorProps = {
    profile,
    onBack: () => setEditing(null),
    onSave: save,
  };

  const renderSection = (section: (typeof SECTIONS)[number]) => {
    const Icon = section.icon;
    return (
      <button
        key={section.id}
        type="button"
        onClick={() => {setSavedSection(null);setEditing(section.id);}}
        className={`profile-directory-row${savedSection === section.id ? " ui-local-update" : ""}`}
        data-voice-avoid
      >
        <span className={`profile-directory-icon ${section.tint}`} aria-hidden="true">
          <Icon width={28} height={28} />
        </span>
        <span className="profile-directory-copy">
          <span className="profile-label">{section.title}</span>
          <span className="profile-help">{sectionSummary(profile, section.id)}</span>
        </span>
        <span className="profile-directory-end">
          {savedSection === section.id && <SavedFeedback />}
          <ChevronRightIcon width={22} height={22} aria-hidden="true" />
        </span>
      </button>
    );
  };

  return (
    <div className="profile-scope profile-overview min-h-full">
      <div className="profile-overview-content">
        <div className="profile-first-screen">
          <h1 className="sr-only">個人檔案</h1>

          <section className="profile-identity" aria-label="個人資料摘要" data-voice-avoid>
            <div className="profile-person">
              <span className="profile-avatar" aria-hidden="true">
                <UserIcon width={34} height={34} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <div className="profile-name">{profile.name || "朋友"}</div>
                <p className="profile-help">已完成 {doneCount} / {SECTIONS.length}</p>
              </div>
            </div>
            <span className="profile-completion-status">{allDone ? "已齊全" : "進行中"}</span>
              <div
                className="profile-progress-track"
                role="progressbar"
                aria-label="個人檔案完成度"
                aria-valuenow={doneCount}
                aria-valuemin={0}
                aria-valuemax={SECTIONS.length}
              >
                <div style={{ width: `${(doneCount / SECTIONS.length) * 100}%` }} />
              </div>
          </section>

          <div className="profile-directory profile-primary-directory" aria-label="健康資料">
            {SECTIONS.map(renderSection)}
            <button type="button" onClick={onOpenMedication} className="profile-directory-row" data-voice-avoid>
              <span className="profile-directory-icon profile-tint-purple" aria-hidden="true">
                <PillIcon width={28} height={28} strokeWidth={1.8} />
              </span>
              <span className="profile-directory-copy">
                <span className="profile-label">我的藥物</span>
                <span className="profile-help">管理藥物與提醒</span>
              </span>
              <span className="profile-directory-end">
                <ChevronRightIcon width={22} height={22} aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>

        <div className="profile-more-content">
          <div className="profile-directory" aria-label="應用程式資訊">
            <button type="button" onClick={onOpenAbout} className="profile-directory-row" data-voice-avoid>
              <span className="profile-directory-icon profile-tint-blue" aria-hidden="true"><InfoIcon width={28} height={28} strokeWidth={1.8} /></span>
              <span className="profile-directory-copy"><span className="profile-label">關於糖友導航</span></span>
              <span className="profile-directory-end"><ChevronRightIcon width={22} height={22} aria-hidden="true" /></span>
            </button>
          </div>
          {onResumeSetup && (
            <section className="profile-section profile-resume-card">
              <h2 className="profile-section-title">首次資料設定未完成</h2>
              <button type="button" onClick={onResumeSetup} className="profile-setup-later">繼續首次資料設定</button>
            </section>
          )}
          {accountSettings?.syncFeedback}
          {accountSettings?.logoutAction}
          {!accountSettings && import.meta.env?.VITE_CLOUD_MODE !== 'true' && <DangerButton fullWidth icon={<TrashIcon width={22} height={22} />} onClick={() => setConfirmReset(true)}>
            重置本機資料
          </DangerButton>}
        </div>
      </div>

      {/* 分區編輯器覆蓋層 */}
      <AnimatePresence>
        {editing === "basic" && <BasicInfoEditor key="basic" {...editorProps} />}
        {editing === "diabetes" && <DiabetesEditor key="diabetes" {...editorProps} />}
        {editing === "conditions" && <ConditionsEditor key="conditions" {...editorProps} />}
        {editing === "care" && <CareEditor key="care" {...editorProps} />}
        {editing === "diet" && <DietExerciseEditor key="diet" {...editorProps} />}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmReset}
        title="重置系統所有資料？"
        message="此操作會清除所有個人檔案及血糖紀錄，無法復原。"
        onConfirm={onResetAll}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
