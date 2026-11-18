/** Reference-counted body scroll lock so nested overlays restore correctly. */
let locks = 0;
let savedOverflow = "";
let savedPosition = "";
let savedTop = "";
let savedLeft = "";
let savedRight = "";
let savedWidth = "";
let savedY = 0;

export function lockBodyScroll(): () => void {
  if (locks === 0) {
    const body = document.body;
    savedY = window.scrollY;
    savedOverflow = body.style.overflow;
    savedPosition = body.style.position;
    savedTop = body.style.top;
    savedLeft = body.style.left;
    savedRight = body.style.right;
    savedWidth = body.style.width;
    document.documentElement.setAttribute("data-scroll-lock", "");
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${savedY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks > 0) return;
    const body = document.body;
    document.documentElement.removeAttribute("data-scroll-lock");
    body.style.overflow = savedOverflow;
    body.style.position = savedPosition;
    body.style.top = savedTop;
    body.style.left = savedLeft;
    body.style.right = savedRight;
    body.style.width = savedWidth;
    window.scrollTo(0, savedY);
  };
}
