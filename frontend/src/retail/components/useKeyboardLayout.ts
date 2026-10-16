import { useEffect, useState } from 'react';
/** Visual viewport follows mobile keyboards. Focus alone must not imply one on desktops. */
export function useKeyboardLayout(){
  const [open,setOpen]=useState(false);
  useEffect(()=>{const viewport=window.visualViewport;let tallest=window.innerHeight,width=window.innerWidth;
    const update=()=>{if(width!==window.innerWidth){width=window.innerWidth;tallest=window.innerHeight;}tallest=Math.max(tallest,window.innerHeight);const editing=document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]');setOpen(!!editing&&!!viewport&&tallest-viewport.height>150);};
    viewport?.addEventListener('resize',update);document.addEventListener('focusin',update);document.addEventListener('focusout',update);window.addEventListener('resize',update);
    return()=>{viewport?.removeEventListener('resize',update);document.removeEventListener('focusin',update);document.removeEventListener('focusout',update);window.removeEventListener('resize',update);};
  },[]);return open;
}
