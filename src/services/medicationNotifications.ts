import { notificationFingerprint } from "../data/notificationSchedule";
import workerUrl from "./notification-worker.js?url&no-inline";
import type { MedicationIntake } from "../data/types";
import {backend} from './backendClient';
export { newDueIntakes } from "../data/notificationSchedule";

export type NotificationAccess = "unsupported" | NotificationPermission;
export function notificationAccess(): NotificationAccess {
  return typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window
    ? Notification.permission
    : "unsupported";
}
let registration: Promise<ServiceWorkerRegistration> | undefined;
export async function subscribeWebPush() {
  if (!window.isSecureContext || !('PushManager' in window) || !('serviceWorker' in navigator)) throw new Error('此裝置或瀏覽器暫不支援網頁推送。');
  const access=notificationAccess();
  const permission=access==='default'?await Notification.requestPermission():access;
  if(permission!=='granted') throw new Error('請先允許系統通知。');
  const key=await backend<{publicKey:string}>('/devices/push-key');
  if(!key.publicKey) throw new Error('推送服務尚未設定。');
  const worker=await notificationWorker();if(!worker) throw new Error('通知服務未能啟動。');
  const decoded=atob(key.publicKey.replace(/-/g,'+').replace(/_/g,'/'));
  const bytes=Uint8Array.from(decoded,char=>char.charCodeAt(0));
  const subscription=await worker.pushManager.getSubscription() || await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
  const data=subscription.toJSON();
  if(!data.endpoint||!data.keys?.p256dh||!data.keys?.auth) throw new Error('瀏覽器訂閱資料不完整。');
  await backend('/devices',{method:'POST',body:{endpoint:data.endpoint,p256dh:data.keys.p256dh,auth:data.keys.auth,deviceType:'web'}});
}
async function notificationWorker() {
  if (!("serviceWorker" in navigator)) return null;
  registration ??= navigator.serviceWorker
    .register(workerUrl)
    .then(async (reg) => {
      if (reg.active) return reg;
      const worker = reg.installing || reg.waiting;
      if (!worker) throw new Error("通知服務未能啟動。");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.removeEventListener("statechange", change);
          reject(new Error("通知服務啟動逾時。"));
        }, 10000);
        const change = () => {
          if (worker.state === "activated" || worker.state === "redundant") {
            clearTimeout(timeout);
            worker.removeEventListener("statechange", change);
            worker.state === "activated"
              ? resolve()
              : reject(new Error("通知服務未能啟動。"));
          }
        };
        worker.addEventListener("statechange", change);
        change();
      });
      return reg;
    })
    .catch((error) => {
      registration = undefined;
      throw error;
    });
  return registration;
}
const desktopNotifications = new Map<string, Notification>();
export async function displayMedicationNotification(
  entry: MedicationIntake,
  tag: string,
  onOpen: (id: string) => void,
  isCurrent: () => boolean = () => true,
) {
  if (notificationAccess() !== "granted") throw new Error("系統通知未獲允許。");
  const options: NotificationOptions = {
    body: `${entry.time} · ${entry.name} · ${entry.amount} ${entry.unit}。請開啟 App 確認。`,
    tag,
    lang: "zh-HK",
    data: {
      intakeId: entry.id,
      fingerprint: notificationFingerprint(entry),
      url: location.href.split("#")[0],
    },
  };
  const reg = await notificationWorker();
  if (!isCurrent()) return;
  if (reg) {
    await reg.showNotification("服藥時間提醒", options);
    if (!isCurrent())
      for (const notification of await reg.getNotifications({ tag }))
        notification.close();
  } else {
    const notification = new Notification("服藥時間提醒", options);
    notification.onclick = () => {
      window.focus();
      onOpen(entry.id);
      notification.close();
    };
    desktopNotifications.set(tag, notification);
  }
}
export async function closeMedicationNotifications(
  prefix: string,
  validEntries: Map<string, string>,
) {
  for (const [tag, notification] of desktopNotifications)
    if (
      tag.startsWith(prefix) &&
      validEntries.get(tag.slice(prefix.length)) !==
        notification.data?.fingerprint
    ) {
      notification.close();
      desktopNotifications.delete(tag);
    }
  // Don't register a worker just to cancel notifications.
  const reg =
    "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistration(workerUrl)
      : null;
  if (reg)
    for (const notification of await reg.getNotifications())
      if (
        notification.tag.startsWith(prefix) &&
        validEntries.get(notification.tag.slice(prefix.length)) !==
          notification.data?.fingerprint
      )
        notification.close();
}
