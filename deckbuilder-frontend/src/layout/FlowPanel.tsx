import { useRef, useState, type ReactNode } from "react";

type Dir = "next" | "prev";

function direction(from: string, to: string, order?: readonly string[]): Dir {
  if (!order) return "next";
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0) return "next";
  return b < a ? "prev" : "next";
}

/** Remounts when `id` changes and plays a large, slow transition. First paint stays still. */
export function FlowPanel({
  id,
  order,
  kind,
  children,
}: {
  id: string;
  order?: readonly string[];
  kind: "tab" | "sub" | "mode";
  children: ReactNode;
}) {
  const prev = useRef(id);
  const [motion, setMotion] = useState<{ id: string; dir: Dir } | null>(null);
  if (id !== prev.current) {
    const dir = direction(prev.current, id, order);
    prev.current = id;
    setMotion({ id, dir });
  }
  const dir = motion?.id === id ? motion.dir : null;
  return (
    <div className={dir ? `flow-panel flow-${kind}-${dir}` : "flow-panel"}>{children}</div>
  );
}
