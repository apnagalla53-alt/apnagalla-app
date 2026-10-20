import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { observeKeyboardLayout } from '../../src/retail/components/useKeyboardLayout';
let doc: EventTarget & { activeElement: { matches: () => boolean } | null };
let viewport: EventTarget & { height: number }, win: EventTarget & { innerHeight: number; innerWidth: number; visualViewport?: typeof viewport };
let stop: () => void, changed: ReturnType<typeof vi.fn>;
const event = (name: string, id = 1) => Object.assign(new Event(name), { pointerId: id });
beforeEach(() => {
  vi.useFakeTimers();
  doc = Object.assign(new EventTarget(), { activeElement: null as { matches: () => boolean } | null });
  viewport = Object.assign(new EventTarget(), { height: 844 });
  win = Object.assign(new EventTarget(), { innerHeight: 844, innerWidth: 390, visualViewport: viewport });
  vi.stubGlobal('document', doc); vi.stubGlobal('window', win);
  changed = vi.fn(); stop = observeKeyboardLayout(changed);
});
afterEach(() => { stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function keyboard() { doc.activeElement = { matches: () => true }; viewport.height = 550; viewport.dispatchEvent(new Event('resize')); }
test('desktop input focus does not hide navigation', () => { doc.activeElement = { matches: () => true }; doc.dispatchEvent(new Event('focusin')); expect(changed).not.toHaveBeenCalled(); });
test('input blur cannot close a keyboard that is still on screen', () => { keyboard(); doc.activeElement = null; doc.dispatchEvent(new Event('focusout')); expect(changed.mock.calls).toEqual([[true]]); viewport.height = 844; viewport.dispatchEvent(new Event('resize')); expect(changed.mock.calls).toEqual([[true], [false]]); });
test('restoring the viewport during a tap waits until after the click', () => { keyboard(); doc.dispatchEvent(event('pointerdown')); doc.activeElement = null; viewport.height = 844; doc.dispatchEvent(new Event('focusout')); viewport.dispatchEvent(new Event('resize')); doc.dispatchEvent(event('pointerup')); expect(changed.mock.calls).toEqual([[true]]); vi.runAllTimers(); expect(changed.mock.calls).toEqual([[true], [false]]); });
test('cancelled gestures release the layout lock', () => { keyboard(); doc.dispatchEvent(event('pointerdown')); viewport.height = 844; doc.dispatchEvent(event('pointercancel')); vi.runAllTimers(); expect(changed).toHaveBeenLastCalledWith(false); });
test('overlapping pointers keep the layout stable until both release', () => { keyboard(); doc.dispatchEvent(event('pointerdown', 1)); doc.dispatchEvent(event('pointerdown', 2)); viewport.height = 844; doc.dispatchEvent(event('pointerup', 1)); vi.runAllTimers(); expect(changed).toHaveBeenCalledTimes(1); doc.dispatchEvent(event('pointerup', 2)); vi.runAllTimers(); expect(changed).toHaveBeenLastCalledWith(false); });
test('rotation resets the viewport baseline', () => { keyboard(); win.innerWidth = 844; win.innerHeight = 390; viewport.height = 390; win.dispatchEvent(new Event('resize')); expect(changed).toHaveBeenLastCalledWith(false); });
test('cleanup removes pending layout updates and event listeners', () => { keyboard(); doc.dispatchEvent(event('pointerdown')); viewport.height = 844; doc.dispatchEvent(event('pointerup')); stop(); vi.runAllTimers(); doc.dispatchEvent(new Event('focusout')); viewport.dispatchEvent(new Event('resize')); expect(changed.mock.calls).toEqual([[true]]); });
test('without visualViewport, focus never implies a keyboard', () => { stop(); delete win.visualViewport; stop = observeKeyboardLayout(changed); doc.activeElement = { matches: () => true }; doc.dispatchEvent(new Event('focusin')); expect(changed).not.toHaveBeenCalled(); });

test('leaving the browser during a gesture cannot leave the layout locked', () => { keyboard(); doc.dispatchEvent(event('pointerdown')); viewport.height = 844; win.dispatchEvent(new Event('blur')); expect(changed).toHaveBeenLastCalledWith(false); });
