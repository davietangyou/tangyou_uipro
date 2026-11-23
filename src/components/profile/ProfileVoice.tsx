import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
type Register = (id: string, node: HTMLElement) => () => void;
export const ProfileVoiceContext = createContext<Register | null>(null);
export function useProfileVoiceRegistry() {
  const [slots, setSlots] = useState<Record<string, HTMLElement>>({});
  const register = useCallback<Register>((id, node) => {
    setSlots((prev) => ({ ...prev, [id]: node }));
    return () =>
      setSlots((prev) => {
        if (prev[id] !== node) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
  }, []);
  return {
    register,
    forRoute(route: string) {
      const matches = Object.entries(slots).filter(([id]) => id.startsWith(`${route}:`));
      const entry = matches[0];
      return entry ? {route:entry[0],node:entry[1]} : null;
    },
  };
}
export function ProfileVoiceSlot({ id }: { id: string }) {
  const register = useContext(ProfileVoiceContext);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (node && register) return register(id, node);
  }, [node, register, id]);
  return <div ref={setNode} hidden />;
}
