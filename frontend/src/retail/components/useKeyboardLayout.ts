import { useEffect, useState } from 'react';

/** Follow keyboard geometry, keeping a pointer gesture on the same layout through its click. */
export function observeKeyboardLayout(onChange: (open: boolean) => void) {
  const viewport = window.visualViewport;
  let tallest = window.innerHeight, width = window.innerWidth, open = false;
  let settling: ReturnType<typeof setTimeout> | undefined;
  const pointers = new Set<number>();
  const update = () => {
    if (pointers.size || settling !== undefined) return;
    if (width !== window.innerWidth) { width = window.innerWidth; tallest = window.innerHeight; }
    tallest = Math.max(tallest, window.innerHeight);
    const editing = document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]');
    // Blur arrives before a mobile keyboard has closed. Do not restore the banner/footer on blur.
    const next = !!viewport && tallest - viewport.height > 150 && (!!editing || open);
    if (next !== open) { open = next; onChange(open); }
  };
  const press = (event: PointerEvent) => {
    if (settling !== undefined) { clearTimeout(settling); settling = undefined; }
    pointers.add(event.pointerId);
  };
  const release = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (!pointers.size) {
      if (settling !== undefined) clearTimeout(settling);
      // Pointerup's native click must run before layout changes.
      settling = setTimeout(() => { settling = undefined; update(); }, 0);
    }
  };
  const cancel = () => { pointers.clear(); if (settling !== undefined) clearTimeout(settling); settling = undefined; update(); };
  window.addEventListener('blur', cancel);
  viewport?.addEventListener('resize', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', update);
  document.addEventListener('pointerdown', press, true);
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
  window.addEventListener('resize', update);
  update();
  return () => {
    if (settling !== undefined) clearTimeout(settling);
    viewport?.removeEventListener('resize', update);
    document.removeEventListener('focusin', update);
    document.removeEventListener('focusout', update);
    document.removeEventListener('pointerdown', press, true);
    document.removeEventListener('pointerup', release, true);
    document.removeEventListener('pointercancel', release, true);
    window.removeEventListener('resize', update);
    window.removeEventListener('blur', cancel);
  };
}
export function useKeyboardLayout() {
  const [open, setOpen] = useState(false);
  useEffect(() => observeKeyboardLayout(setOpen), []);
  return open;
}
