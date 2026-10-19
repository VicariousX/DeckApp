/**
 * @deprecated Import from ./overlayManager instead.
 * Kept so existing call sites continue to work.
 */
export { pushOverlay, pushOverlayEntry, getTop, isTop, overlayCount, peekNextZ } from "./overlayManager";
export type { OverlayType, PushOptions, OverlayHandle } from "./overlayManager";
