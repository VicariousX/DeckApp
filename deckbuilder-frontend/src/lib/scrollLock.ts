/** Reference-counted body scroll lock so nested overlays restore correctly. */
let locks = 0;
let saved = "";

export function lockBodyScroll(): () => void {
  if (locks === 0) saved = document.body.style.overflow;
  locks += 1;
  document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.overflow = saved;
  };
}
