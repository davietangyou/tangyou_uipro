import { useCallback, useEffect, useRef, useState } from "react";
import type { UserProfile } from "../data/types";
import {
  loadProfile,
  storageKey,
  writeStored,
} from "../services/storage";
export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const current = useRef(profile);
  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    const next = { ...loadProfile(), ...patch };
    writeStored("profile", next);
    current.current = next;
    setProfile(next);
  }, []);
  const transactProfile = useCallback(
    async (transform: (profile: UserProfile) => UserProfile) => {
      const commit = () => {
        const previous = loadProfile();
        const next = transform(previous);
        if (next !== previous) writeStored("profile", next);
        current.current = next;
        setProfile(next);
      };
      if (navigator.locks)
        await navigator.locks.request(
          storageKey("profile-transaction"),
          commit,
        );
      else commit();
    },
    [],
  );
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === storageKey("profile")) {
        try {
          const next = loadProfile();
          current.current = next;
          setProfile(next);
        } catch {
          /* Preserve visible data if another tab writes invalid data. */
        }
      }
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  const resetAll = useCallback(() => {
    const scoped = storageKey("");
    const prefix = scoped === "dia_v2_" ? "dia_" : scoped;
    for (const k of Object.keys(localStorage))
      if (k.startsWith(prefix)) localStorage.removeItem(k);
    location.reload();
  }, []);
  return { profile, updateProfile, transactProfile, resetAll };
}
