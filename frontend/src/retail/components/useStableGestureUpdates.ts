import { useEffect, useRef } from 'react';

/** Keep asynchronous search results from moving a control between press and click. */
export function useStableGestureUpdates() {
  const pointers = useRef(new Set<number>()), pending = useRef<Array<() => void>>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const flush = () => {
      timer.current = undefined;
      const updates = pending.current.splice(0);
      if (mounted.current) updates.forEach(update => update());
    };
    const release = (event: PointerEvent) => {
      if (!pointers.current.delete(event.pointerId)) return;
      if (!pointers.current.size) {
        if (timer.current !== undefined) clearTimeout(timer.current);
        // A pointerup's click still uses the layout where the press started.
        timer.current = setTimeout(flush, 0);
      }
    };
    const cancel = () => { pointers.current.clear(); if (timer.current !== undefined) clearTimeout(timer.current); flush(); };
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', cancel);
    return () => {
      mounted.current = false;
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = undefined; pending.current = []; pointers.current.clear();
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', cancel);
    };
  }, []);
  return {
    start: (pointerId: number) => {
      if (timer.current !== undefined) { clearTimeout(timer.current); timer.current = undefined; }
      pointers.current.add(pointerId);
    },
    update: (apply: () => void) => {
      if (!mounted.current) return;
      if (pointers.current.size || timer.current !== undefined) pending.current.push(apply);
      else apply();
    },
  };
}
