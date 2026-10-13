import { ui, useUiLanguage } from "../../i18n";
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
  type ChangeEvent,
  type ComponentType,
} from "react";
import {
  Check,
  ChevronDown,
  Search,
  X,
  Plus,
  SlidersHorizontal,
  Circle,
} from "lucide-react";
import "./mobile-controls.css";

export type Choice = {
  value: string;
  label: string;
  description?: string;
  group?: string;
  disabled?: boolean;
  Icon?: ComponentType<{ size?: number }>;
};
// Deferred onboarding can overlap an existing sheet. Unlock scrolling only
// after the last open sheet closes, regardless of their closing order.
let openSheetCount = 0;
let originalBodyOverflow = "";
export function Sheet({
  open,
  onClose,
  title,
  titleIcon,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  titleIcon?: ReactNode;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useUiLanguage();
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  if (open && !ref.current?.open)
    returnFocus.current = document.activeElement as HTMLElement | null;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = returnFocus.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    if (openSheetCount === 0)
      originalBodyOverflow = document.body.style.overflow;
    openSheetCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      openSheetCount -= 1;
      if (openSheetCount === 0)
        document.body.style.overflow = originalBodyOverflow;
    };
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      className="r-mobile-sheet"
      aria-labelledby={titleId}
      onKeyDownCapture={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="r-sheet-handle" aria-hidden="true" />
      <header className="r-sheet-header">
        {titleIcon && <span className="r-sheet-title-icon" aria-hidden="true">{titleIcon}</span>}
        <div>
          <h2 id={titleId}>{ui(title)}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="r-btn r-btn--icon"
          aria-label={"Close " + title}
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      <div className="r-sheet-body">{children}</div>
      {footer && <footer className="r-sheet-footer">{footer}</footer>}
    </dialog>
  );
}
export function SearchField({
  id,
  value,
  onChange,
  label = "Search",
  placeholder = "Search…",
  autoFocus = false,
  onEnter,
}: {
  id?: string;
  value: string;
  onChange: (s: string) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?:()=>void;
}) {
  useUiLanguage();
  return (
    <div className="r-mobile-search">
      <Search size={20} aria-hidden="true" />
      <input
        id={id}
        type="search"
        aria-label={ui(label)}
        placeholder={ui(placeholder)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
          onKeyDown={event=>{if(event.key==='Enter'&&onEnter){event.preventDefault();onEnter();}}}
        autoFocus={autoFocus}
      />
      {value && (
        <button
          type="button"
          aria-label={"Clear " + label}
          onClick={() => onChange("")}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  useUiLanguage();
  return (
    <div role="status" className="r-mobile-loading">
      <span />
      <span />
      <span />
      <p>{ui(label)}</p>
    </div>
  );
}
export function EmptyState({
  Icon = Search,
  title,
  description,
  action,
  onAction,
}: {
  Icon?: ComponentType<{ size?: number }>;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  useUiLanguage();
  return (
    <div className="r-empty">
      <Icon size={36} aria-hidden="true" />
      <h3>{ui(title)}</h3>
      <p>{ui(description)}</p>
      {action && onAction && (
        <button
          type="button"
          className="r-btn r-btn--primary"
          onClick={onAction}
        >
          {ui(action)}
        </button>
      )}
    </div>
  );
}
export function SelectionSheet({
  open,
  onClose,
  title,
  subtitle,
  options,
  value,
  onSelect,
  multiple = false,
  loading = false,
  error,
  onRetry,
  onSearch,
  onAdd,
  addLabel = "Add new",
  onClear,
  recent = [],
  listId,
  onMore,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: Choice[];
  value: string | string[];
  onSelect: (v: string) => void;
  multiple?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onSearch?: (s: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  onClear?: () => void;
  recent?: string[];
  listId?: string;
  onMore?: () => void;
}) {
  useUiLanguage();
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (open) {
      setSearch("");
      onSearch?.("");
    }
  }, [open]);
  const rows = onSearch
    ? options
    : options.filter((o) =>
        (o.label + " " + (o.description || ""))
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
  const ordered = search
    ? rows
    : [
        ...rows.filter((o) => recent.includes(o.value)),
        ...rows.filter((o) => !recent.includes(o.value)),
      ];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={ui(title)}
      subtitle={subtitle}
      footer={
        <div className="r-sheet-actions">
          {onClear && (
            <button
              type="button"
              className="r-btn r-btn--outline"
              onClick={() => {
                onClear();
                onClose();
              }}
            >
              Clear selection
            </button>
          )}
          {onAdd && (
            <button
              type="button"
              className="r-btn r-btn--outline"
              onClick={() => {
                onClose();
                onAdd();
              }}
            >
              <Plus size={20} />
              {addLabel}
            </button>
          )}
          {multiple && (
            <button
              type="button"
              className="r-btn r-btn--primary"
              onClick={onClose}
            >{ui("Done")}</button>
          )}
        </div>
      }
    >
      <SearchField
        label={"Search " + title.toLowerCase()}
        placeholder="Search or browse…"
        value={search}
        onChange={(s) => {
          setSearch(s);
          onSearch?.(s);
        }}
        autoFocus
      />
      {loading ? (
        <LoadingState label="Searching…" />
      ) : error ? (
        <div role="alert" className="r-state-message">
          <p>{error}</p>
          {onRetry && (
            <button type="button" className="r-btn" onClick={onRetry}>{ui("Try Again")}</button>
          )}
        </div>
      ) : !ordered.length ? (
        <EmptyState
          title={ui("No matches found")}
          description={ui("Try another search or add a new record.")}
          action={onAdd ? addLabel : undefined}
          onAction={
            onAdd
              ? () => {
                  onClose();
                  onAdd();
                }
              : undefined
          }
        />
      ) : (
        <div
          id={listId}
          className="r-sheet-options"
          role="listbox"
          aria-label={ui(title)}
          aria-multiselectable={multiple || undefined}
          onKeyDown={(e) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
              return;
            const rows = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>(
                'button[role="option"]:not(:disabled)',
              ),
            );
            if (!rows.length) return;
            e.preventDefault();
            const index = rows.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            rows[
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? rows.length - 1
                  : (index + (e.key === "ArrowDown" ? 1 : -1) + rows.length) %
                    rows.length
            ]?.focus();
          }}
        >
          {ordered.map((o, i) => {
            const selected = Array.isArray(value)
              ? value.includes(o.value)
              : value === o.value;
            const Icon = o.Icon;
            const group =
              o.group ||
              (recent.includes(o.value) && !search ? "Recently selected" : "");
            const prior = i
              ? ordered[i - 1].group ||
                (recent.includes(ordered[i - 1].value) && !search
                  ? "Recently selected"
                  : "")
              : "";
            return (
              <div key={o.value}>
                {group && group !== prior && (
                  <h3 aria-hidden="true" className="r-sheet-group">
                    {group}
                  </h3>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={o.disabled}
                  data-choice-value={o.value}
                  className={
                    "r-sheet-option" + (selected ? " is-selected" : "")
                  }
                  onClick={() => {
                    onSelect(o.value);
                    if (!multiple) onClose();
                  }}
                >
                  {Icon && <Icon size={23} />}
                  <span>
                    <strong>{ui(o.label)}</strong>
                    {o.description && <small>{o.description}</small>}
                  </span>
                  {selected ? (
                    <Check size={22} aria-hidden="true" />
                  ) : multiple ? (
                    <Circle size={20} aria-hidden="true" />
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {onMore && (
        <button type="button" className="r-btn r-w-full" onClick={onMore}>{ui("Load More")}</button>
      )}
    </Sheet>
  );
}
export const SearchableSelectionSheet = SelectionSheet;
export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: Choice[];
  value: string;
  onChange: (s: string) => void;
  disabled?: boolean;
}) {
  useUiLanguage();
  return (
    <div className="r-mobile-segments" role="group" aria-label={ui(label)}>
      {options.map((o) => (
        <button
          type="button"
          data-choice-value={o.value}
          key={o.value}
          aria-pressed={value === o.value}
          disabled={disabled || o.disabled}
          className={value === o.value ? "is-selected" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.Icon && <o.Icon size={21} />}
          <span>{ui(o.label)}</span>
          {value === o.value && <Check size={16} aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
const textOf = (node: ReactNode): string =>
  Children.toArray(node)
    .map((n) =>
      isValidElement<{ children?: ReactNode }>(n)
        ? textOf(n.props.children)
        : String(n),
    )
    .join("");
function choicesOf(children: ReactNode, group?: string): Choice[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string;
        children?: ReactNode;
        disabled?: boolean;
        label?: string;
      }>(child)
    )
      return [];
    if (child.type === "option")
      return [
        {
          value: String(child.props.value ?? textOf(child.props.children)),
          label: textOf(child.props.children),
          disabled: child.props.disabled,
          group,
        },
      ];
    return choicesOf(child.props.children, child.props.label || group);
  });
}
export type MobileSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "multiple"
> & {
  presentation?: "sheet" | "segments";
  title?: string;
  onSearch?: (s: string) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  onMore?: () => void;
};
/** Reuses existing option values/handlers, while rendering an accessible mobile interaction. */
export function MobileSelect({
  children,
  value,
  onChange,
  id,
  disabled,
  required,
  name,
  title,
  presentation = "sheet",
  onSearch,
  loading,
  error,
  onRetry,
  onAdd,
  addLabel,
  onMore,
  ...props
}: MobileSelectProps) {
  useUiLanguage();
  const fallback = useId(),
    controlId = id || fallback,
    ref = useRef<HTMLButtonElement>(null),
    [open, setOpen] = useState(false),
    [label, setLabel] = useState(
      title || String(props["aria-label"] || "Choose an option"),
    ),
    [recent, setRecent] = useState<string[]>([]);
  const options = choicesOf(children),
    selected = String(value ?? ""),
    current = options.find((o) => o.value === selected);
  useEffect(() => {
    const node = ref.current;
    const labels = node?.labels;
    setLabel(
      title ||
        String(
          props["aria-label"] ||
            labels?.[0]?.textContent?.trim() ||
            Array.from(document.getElementsByTagName("label"))
              .find((l) => l.htmlFor === controlId)
              ?.textContent?.trim() ||
            node?.closest("label")?.childNodes[0]?.textContent?.trim() ||
            "Choose an option",
        ),
    );
  }, [title, props["aria-label"]]);
  const choose = (v: string) => {
    onChange?.({
      target: { value: v },
      currentTarget: { value: v },
    } as ChangeEvent<HTMLSelectElement>);
    setRecent((prev) => [v, ...prev.filter((x) => x !== v)].slice(0, 3));
  };
  if (presentation === "segments")
    return (
      <div id={controlId} data-mobile-select data-selection-value={selected}>
        <SegmentedControl
          label={ui(label)}
          options={options}
          value={selected}
          onChange={choose}
          disabled={disabled}
        />
      </div>
    );
  return (
    <>
      <button
        {...{ id: controlId, disabled }}
        ref={ref}
        type="button"
        role="combobox"
        aria-label={ui(label)}
        aria-expanded={open}
        aria-controls={controlId + "-options"}
        aria-haspopup="listbox"
        aria-required={required || undefined}
        data-mobile-select
        data-selection-value={selected}
        className="r-selection-field"
        onClick={() => setOpen(true)}
      >
        <span>{current?.label || "Choose…"}</span>
        <ChevronDown size={20} aria-hidden="true" />
      </button>
      <input
        className="r-validation-proxy"
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        required={required}
        disabled={disabled}
        value={selected}
        onChange={() => {}}
        onInvalid={(e) => {
          e.preventDefault();
          ref.current?.focus();
          setOpen(true);
        }}
      />
      <SelectionSheet
        open={open}
        onClose={() => setOpen(false)}
        title={ui(label)}
        listId={controlId + "-options"}
        options={options}
        value={selected}
        onSelect={choose}
        recent={recent}
        onSearch={onSearch}
        loading={loading}
        error={error}
        onRetry={onRetry}
        onAdd={onAdd}
        addLabel={addLabel}
        onMore={onMore}
        onClear={
          options.some((o) => o.value === "") ? () => choose("") : undefined
        }
      />
    </>
  );
}
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  actions: {
    label: string;
    onAction: () => void;
    Icon?: Choice["Icon"];
    disabled?: boolean;
  }[];
}) {
  useUiLanguage();
  return (
    <Sheet open={open} onClose={onClose} title={ui(title)}>
      <div className="r-sheet-options">
        {actions.map((a) => (
          <button
            type="button"
            className="r-sheet-option"
            key={a.label}
            disabled={a.disabled}
            onClick={() => {
              onClose();
              a.onAction();
            }}
          >
            {a.Icon && <a.Icon size={22} />}
            <strong>{ui(a.label)}</strong>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
export function FilterSheet({
  open,
  onClose,
  children,
  onApply,
  onClear,
  count = 0,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  onApply: () => void;
  onClear: () => void;
  count?: number;
}) {
  useUiLanguage();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={ui("Filters")}
      subtitle={
        count ? `${count} active filters` : "Choose what you want to see"
      }
      footer={
        <div className="r-sheet-actions">
          <button
            type="button"
            className="r-btn r-btn--outline"
            onClick={onClear}
          >
            Clear All
          </button>
          <button
            type="button"
            className="r-btn r-btn--primary"
            onClick={() => {
              onApply();
              onClose();
            }}
          >
            <SlidersHorizontal size={18} />
            Apply Filters
          </button>
        </div>
      }
    >
      {children}
    </Sheet>
  );
}
export function StickyActionBar({ children }: { children: ReactNode }) {
  useUiLanguage();
  return <div className="r-mobile-sticky-actions">{children}</div>;
}
