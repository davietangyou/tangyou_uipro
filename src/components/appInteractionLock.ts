const locks = new WeakMap<HTMLElement, { count: number; inert: boolean; overflow: string }>();

// A second sheet can open while the first is exiting. Restore the app only
// after the last surface releases its lock.
export function lockAppInteraction() {
  const root = document.getElementById('root');
  if (!root) return () => {};
  const main = root.querySelector('main');
  const state = locks.get(root) ?? { count: 0, inert: root.inert, overflow: main?.style.overflow ?? '' };
  state.count++;
  locks.set(root, state);
  root.inert = true;
  if (main) main.style.overflow = 'hidden';
  return () => {
    state.count--;
    if (state.count) return;
    root.inert = state.inert;
    if (main) main.style.overflow = state.overflow;
    locks.delete(root);
  };
}
