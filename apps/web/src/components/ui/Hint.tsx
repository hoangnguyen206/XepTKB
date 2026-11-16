/**
 * One-time hint (DESIGN-M6-001 §9, AC-M6-12): one sentence placed beside what it explains, closed with "Đã hiểu".
 * The caller shows at most one at a time and marks it seen (`markHintSeen`) on "Đã hiểu" or when the user performs
 * the hinted action.
 */
import { HINT_TEXT, type HintId } from "../../model/hints.js";
import { IconInfo } from "../icons.js";
import { Button } from "./Button.js";

export function Hint(props: { id: HintId; onDismiss: (id: HintId) => void }) {
  return (
    <div className="hint" role="note">
      <IconInfo size={18} />
      <p className="hint-text">{HINT_TEXT[props.id]}</p>
      <Button variant="ghost" size="sm" onClick={() => props.onDismiss(props.id)}>Đã hiểu</Button>
    </div>
  );
}
