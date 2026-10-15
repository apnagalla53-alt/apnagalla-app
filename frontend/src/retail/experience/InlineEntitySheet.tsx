import type { ReactNode } from "react";
import { Sheet } from "../components/MobileControls";
import { ui } from "../../i18n";
/** The parent transaction stays mounted; creators return an entity to that parent. */
export default function InlineEntitySheet({
  open,
  onClose,
  title,
  context,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  context?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={ui(title)}>
      {context && <p className="xp-context-note">{ui(context)}</p>}
      {children}
    </Sheet>
  );
}
