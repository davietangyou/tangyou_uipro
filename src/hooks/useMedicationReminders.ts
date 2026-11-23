import { notificationFingerprint } from "../data/notificationSchedule";
import { notificationIntentForAccess } from "../data/medicationNotification";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UserProfile } from "../data/types";
import { reconcileIntakes, todayIntakes } from "../data/medication";
import { localDate } from "../data/hba1c";
import {
  loadProfile,
  readStored,
  storageKey,
  writeStored,
} from "../services/storage";
import {
  closeMedicationNotifications,
  displayMedicationNotification,
  newDueIntakes,
  notificationAccess,
  subscribeWebPush,
} from "../services/medicationNotifications";

export function useMedicationReminders(
  profile: UserProfile,
  transact: (change: (p: UserProfile) => UserProfile) => Promise<void>,
  onOpen: (id: string) => void,
) {
  const [now, setNow] = useState(() => new Date());
  const [access, setAccess] = useState(notificationAccess);
  const [error, setError] = useState("");
  const current = useRef(profile);
  current.current = profile;
  const open = useRef(onOpen);
  open.current = onOpen;
  const since = useRef(Date.now());
  const prefix = storageKey("medication-notice:");
  const sending = useRef(false);
  useEffect(() => {
    since.current = Date.now();
    const sync = async (resume = false) => {
      const tick = new Date();
      const previous = since.current;
      since.current = tick.getTime();
      setNow(tick);
      setAccess(notificationAccess());
      try {
        const fresh = loadProfile();
        if (reconcileIntakes(fresh, tick) !== fresh)
          await transact((p) => reconcileIntakes(p, tick));
        if (
          resume ||
          import.meta.env?.VITE_CLOUD_MODE === "true" ||
          !fresh.medicationNotifications ||
          notificationAccess() !== "granted" ||
          sending.current
        )
          return;
        const candidates = newDueIntakes(
          todayIntakes(fresh, tick),
          previous,
          tick.getTime(),
        );
        sending.current = true;
        try {
          for (const candidate of candidates) {
            const send = async () => {
              const latest = loadProfile();
              const live = todayIntakes(latest, tick).find(
                (e) =>
                  e.id === candidate.id &&
                  e.status === "pending" &&
                  e.time === candidate.time,
              );
              if (
                !live ||
                !latest.medicationNotifications ||
                notificationAccess() !== "granted"
              )
                return;
              const sent = readStored<{ date: string; ids: string[] }>(
                "medication_notified",
                { date: localDate(tick), ids: [] },
              );
              const ids = sent.date === localDate(tick) ? sent.ids : [];
              if (ids.includes(notificationFingerprint(live))) return;
              // Persist claim before sending; a failure must not cause duplicate alerts.
              writeStored("medication_notified", {
                date: localDate(tick),
                ids: [...ids, notificationFingerprint(live)],
              });
              await displayMedicationNotification(
                live,
                prefix + live.id,
                (id) => open.current(id),
                () => {
                  const p = loadProfile();
                  return (
                    !!p.medicationNotifications &&
                    todayIntakes(p).some(
                      (e) =>
                        e.status === "pending" &&
                        notificationFingerprint(e) ===
                          notificationFingerprint(live),
                    )
                  );
                },
              );
            };
            if (navigator.locks)
              await navigator.locks.request(
                storageKey("medication-notify"),
                send,
              );
            else await send();
          }
        } finally {
          sending.current = false;
        }
      } catch {
        setError(
          "系統通知或提醒資料未能更新，請查看 App 內的服藥安排；原有資料已保留。",
        );
      }
    };
    void sync(true);
    const timer = setInterval(() => void sync(), 15000);
    const resume = () => {
      if (document.visibilityState === "visible") void sync(true);
    };
    const message = (event: MessageEvent) => {
      if (
        event.data?.type === "medication-notification" &&
        typeof event.data.intakeId === "string"
      )
        open.current(event.data.intakeId);
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    navigator.serviceWorker?.addEventListener("message", message);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      navigator.serviceWorker?.removeEventListener("message", message);
    };
  }, [transact, prefix]);
  useEffect(() => {
    const entries = todayIntakes(profile);
    const valid = new Map<string, string>(
      profile.medicationNotifications
        ? entries
            .filter((e) => e.status === "pending")
            .map((e) => [e.id, notificationFingerprint(e)] as [string, string])
        : [],
    );
    void closeMedicationNotifications(prefix, valid).catch(() =>
      setError("未能清除已顯示的系統通知，請以 App 內最新安排為準。"),
    );
  }, [profile, prefix]);
  useEffect(() => {
    if (access === "granted" || !profile.medicationNotifications) return;
    void transact((p) =>
      p.medicationNotifications
        ? { ...p, medicationNotifications: false }
        : p,
    ).catch(() =>
      setError("未能同步系統通知狀態，您仍可在 App 內查看提醒。"),
    );
  }, [access, profile.medicationNotifications, transact]);
  const enable = useCallback(async () => {
    setError("");
    try {
      if(import.meta.env?.VITE_CLOUD_MODE === "true") {
        const permission=notificationAccess();
        if(permission==='denied'||permission==='unsupported'){setAccess(permission);return permission;}
        await subscribeWebPush();
        await transact(p=>({...p,medicationNotifications:true}));
        setAccess("granted");
        return "granted" as const;
      }
      let permission = notificationAccess();
      if (permission === "default")
        permission = await Notification.requestPermission();
      setAccess(permission);
      const shouldEnable = notificationIntentForAccess(permission);
      if (!!current.current.medicationNotifications !== shouldEnable)
        await transact((p) => ({
          ...p,
          medicationNotifications: shouldEnable,
        }));
      return permission;
    } catch (error) {
      setAccess(notificationAccess());
      setError(error instanceof Error?error.message:"未能啟用系統通知，您仍可在 App 內查看提醒。");
      return null;
    }
  }, [transact]);
  const disable = useCallback(async () => {
    try {
      await transact((p) => ({ ...p, medicationNotifications: false }));
    } catch {
      setError("未能儲存通知設定，請再試一次。");
    }
  }, [transact]);
  return {
    now,
    access,
    error,
    enable,
    disable,
    enabled: !!profile.medicationNotifications,
  };
}
export type MedicationReminderControls = ReturnType<
  typeof useMedicationReminders
>;
