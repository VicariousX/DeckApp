import type { MembershipMeasure } from "../services/membershipService";

type Props = {
  memberships: MembershipMeasure[];
  onRemove?: (m: MembershipMeasure) => void;
  emptyText?: string;
  /** Optional class names so the same list can sit in drawers or the inspector. */
  className?: string;
  itemClassName?: string;
  nameClassName?: string;
  measureClassName?: string;
  emptyClassName?: string;
};

/** Shared list of group memberships (decks / drawers / collections) with measure. */
export function MembershipList({
  memberships,
  onRemove,
  emptyText = "Not in any groups.",
  className,
  itemClassName,
  nameClassName,
  measureClassName,
  emptyClassName,
}: Props) {
  if (memberships.length === 0) {
    return <p className={emptyClassName}>{emptyText}</p>;
  }
  return (
    <ul className={className}>
      {memberships.map((m) => (
        <li key={`${m.kind}-${m.groupId}-${m.board ?? ""}`} className={itemClassName}>
          <span className={nameClassName}>
            {m.groupName}
            {m.board ? ` (${m.board})` : ""}
          </span>
          <span className={measureClassName}>{m.label}</span>
          {onRemove && (
            <button type="button" onClick={() => onRemove(m)} style={{ marginLeft: 8 }}>
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
