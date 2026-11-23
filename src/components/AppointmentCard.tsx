import { DeviceModal } from './DeviceModal';
import { useRef, useState, type CSSProperties } from "react";
import { CalendarDays, Check, X } from "lucide-react";
import "../styles/appointment.css";
import type { UserProfile } from "../data/types";
import { localDate, validDate } from "../data/hba1c";
import { validTime } from "../data/medication";
import appointmentArtwork from "../assets/home/appointment-card.webp";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProfileVoiceSlot } from "./profile/ProfileVoice";

export function appointmentDateLabel(date?: string) {
  if (!date || !validDate(date)) return "";
  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00`));
}
export function AppointmentCard({
  profile,
  onEdit,
  onQuestions,
  onStatusChange,
  variant = "default",
}: {
  profile: UserProfile;
  onEdit: () => void;
  onQuestions?: () => void;
  onStatusChange?: (status: "completed" | "cancelled") => void;
  variant?: "default" | "home" | "summary" | "questions";
}) {
  const date = profile.nextClinicDate;
  const label = appointmentDateLabel(date);
  const status = profile.nextClinicStatus ?? (date ? "scheduled" : undefined);
  const active = status === "scheduled";
  const past = active && !!date && date < localDate();
  const [confirmStatus,setConfirmStatus] = useState<"completed" | "cancelled" | null>(null);
  return (
    <section
      className={`care-card care-lilac appointment-card${variant === "home" ? " home-appointment-card" : ""}${variant === "summary" ? " appointment-summary" : ""}${variant === "questions" ? " appointment-compact" : ""}`}
      aria-label="下次覆診"
      style={
        variant !== "default"
          ? ({ "--home-appointment-art": `url(${appointmentArtwork})` } as CSSProperties)
          : undefined
      }
    >
      <div className="appointment-heading-and-date"><div className="appointment-heading">
        {variant !== "questions" && <p className="care-eyebrow">覆診安排</p>}
        <h2>{variant === "questions" && <CalendarDays size={20} aria-hidden="true"/>}{active || !status ? "下次覆診" : "最近覆診"}</h2>
      </div>
      <p className="appointment-date">
        {label && variant === "questions"
          ? <time dateTime={date} aria-label={label}>{date!.replaceAll('-', '/')}（{new Intl.DateTimeFormat('zh-HK',{weekday:'narrow'}).format(new Date(`${date}T12:00:00`))}）</time>
          : label
          ? label.split(/(?=星期)/).map((part) => (
              <span className="appointment-date-part" key={part}>{part}</span>
            ))
          : label || "尚未設定覆診日期"}
      </p>
      </div>
      {label && (profile.nextClinicTime || profile.nextClinicLocation) && (
        <div className="appointment-meta">
          {profile.nextClinicTime && <p>時間：{profile.nextClinicTime}</p>}
          {profile.nextClinicLocation && (
            <p>地點：{profile.nextClinicLocation}</p>
          )}
        </div>
      )}
      {past && (
        <p className="care-warning">這個覆診日期已過，請更新下次安排。</p>
      )}
      {active && date === localDate() && <p className="appointment-status">今天覆診</p>}
      <div className="appointment-actions">
        <button type="button" className="care-secondary" data-voice-avoid onClick={onEdit} aria-label={active && label ? '修改覆診資料' : undefined}>
          {active && label ? variant === "questions" ? "修改資料" : "修改覆診資料" : label ? "設定新覆診" : "新增覆診資料"}
        </button>
        {onQuestions && <button type="button" className="care-secondary" data-voice-avoid onClick={onQuestions}>查看覆診清單</button>}
      </div>
      {active && label && onStatusChange && <div className="appointment-actions appointment-status-actions">
        <button className="care-secondary" type="button" onClick={() => setConfirmStatus("completed")}><Check size={18} aria-hidden="true" />標記完成</button>
        <button className="care-secondary" type="button" onClick={() => setConfirmStatus("cancelled")}><X size={18} aria-hidden="true" />取消覆診</button>
      </div>}
      <ConfirmDialog
        appearance="profile"
        open={confirmStatus!==null}
        title={confirmStatus==="completed"?"標記這次覆診為完成？":"取消這次覆診？"}
        message={confirmStatus==="completed"?"完成後將停止顯示這次覆診的提醒。":"取消後將停止顯示這次覆診的提醒。"}
        confirmText={confirmStatus==="completed"?"確認完成":"確認取消"}
        onConfirm={()=>{if(confirmStatus)onStatusChange?.(confirmStatus);setConfirmStatus(null);}}
        onCancel={()=>setConfirmStatus(null)}
      />
    </section>
  );
}
export function AppointmentEditor({
  appearance,
  profile,
  onSave,
  onClose,
}: {
  appearance?: "questions";
  profile: UserProfile;
  onSave: (patch: Partial<UserProfile>) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(profile.nextClinicDate || "");
  const [time, setTime] = useState(profile.nextClinicTime || "");
  const [location, setLocation] = useState(profile.nextClinicLocation || "");
  const [error, setError] = useState("");
  const done = useRef(onClose); done.current = onClose;
  const [open, setOpen] = useState(true);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const close = () => { if (!saving.current) setOpen(false); };
  return (
    <DeviceModal open={open} onClose={close} onExitComplete={() => done.current()} label="appointment-title" placement={appearance === "questions" ? "sheet" : "center"} className={`care-dialog appointment-editor${appearance === "questions" ? " question-appointment-panel" : ""}`}>
      <form
        className="care-card med-editor"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!validDate(date)) {
            setError("請選擇有效的覆診日期。");
            return;
          }
          if (time && !validTime(time)) {
            setError("請填寫有效的覆診時間。");
            return;
          }
          if (saving.current) return;
          saving.current = true;
          setBusy(true);
          try {
            onSave({
              nextClinicDate: date,
              nextClinicTime: time,
              nextClinicLocation: location.trim(),
              nextClinicStatus: "scheduled",
            });
            setOpen(false);
          } catch {
            setError("未能儲存覆診資料，輸入內容已保留，請再試一次。");
          } finally { saving.current = false; setBusy(false); }
        }}
      >
        <div className="appointment-editor-heading">
          <h2 id="appointment-title">覆診資料</h2>
          <ProfileVoiceSlot id="appointment:editor" />
        </div>
        <label className="care-field">
          覆診日期（必填）
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="care-field">
          覆診時間（選填）
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label className="care-field">
          診所／地點（選填）
          <input
            value={location}
            placeholder={appearance === "questions" ? "請填寫診所或地點" : undefined}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>
        {error && (
          <p className="care-warning" role="alert">
            {error}
          </p>
        )}
        <div className="care-actions">
          <button className="care-primary" disabled={busy}>{busy ? "正在儲存…" : "儲存覆診資料"}</button>
          <button type="button" className="care-secondary" onClick={close}>
            取消
          </button>
        </div>
      </form>
    </DeviceModal>
  );
}
