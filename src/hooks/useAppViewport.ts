import { useSyncExternalStore } from "react";
import { subscribeInputViewport, getInputViewport } from "../services/inputViewport";

const emptySnapshot = () => null;
const noSubscription = () => () => {};

/** React subscribes to semantics; native geometry is committed directly to shared CSS. */
export function useAppViewport(active = true) {
  return useSyncExternalStore(
    active ? subscribeInputViewport : noSubscription,
    active ? getInputViewport : emptySnapshot,
    emptySnapshot,
  );
}
