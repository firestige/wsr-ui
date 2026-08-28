import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function OwnedInspector({
  open,
  kind,
  modal,
  title,
  invokerRef,
  onClose,
  children,
}: {
  open: boolean;
  kind: "explanation" | "receipt" | "evidence";
  modal: boolean;
  title: string;
  invokerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel === null) return;
    const returnTarget = invokerRef.current;
    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
    focusables()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!modal || event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnTarget?.focus();
    };
  }, [invokerRef, modal, onClose, open]);

  if (!open) return null;
  return (
    <div className="inspector-backdrop" data-modal={modal || undefined}>
      <div
        aria-labelledby={titleId}
        aria-modal={modal || undefined}
        className="owned-inspector"
        data-kind={kind}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="inspector-header">
          <h2 className="text-heading" id={titleId}>
            {title}
          </h2>
          <button className="action-control" onClick={onClose} type="button">
            Close inspector
          </button>
        </header>
        <div className="inspector-content">{children}</div>
      </div>
    </div>
  );
}
