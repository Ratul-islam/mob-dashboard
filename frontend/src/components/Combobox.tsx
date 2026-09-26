"use client";

import { useId, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown, X } from "lucide-react";
import { formatInt } from "@/lib/format";
import { Spinner } from "./ui";

export interface ComboOption {
  value: string;
  count?: number;
}

const MAX_SHOWN = 200;

/**
 * A text box with a filtered dropdown: pick a suggestion, or type any value and press Enter
 * (or leave the field) to apply it as-is. An empty value means "all".
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  loading,
  onSearch,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder: string;
  loading?: boolean;
  /** Called with the typed text, for server-side suggestion lookups. */
  onSearch?: (text: string) => void;
  className?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(-1);
  // Set when a value was just committed, so the blur that follows doesn't commit the typed text again.
  const committed = useRef(false);

  // Show the committed value unless the user is typing.
  const shown = editing ? text : value;
  const needle = editing ? text.trim().toLowerCase() : "";
  const matches = (needle ? options.filter((o) => o.value.toLowerCase().includes(needle)) : options).slice(0, MAX_SHOWN);

  const commit = (next: string) => {
    committed.current = true;
    const v = next.trim();
    setEditing(false);
    setOpen(false);
    setActive(-1);
    onSearch?.("");
    if (v !== value) onChange(v);
  };

  const cancel = () => {
    setEditing(false);
    setOpen(false);
    setActive(-1);
    onSearch?.("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(active >= 0 && matches[active] ? matches[active].value : shown);
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      cancel();
      inputRef.current?.blur();
    }
  };

  return (
    <div className={clsx("relative", className)}>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={shown}
        placeholder={placeholder}
        onFocus={() => {
          committed.current = false;
          setText(value);
          setEditing(true);
          setOpen(true);
        }}
        onChange={(e) => {
          committed.current = false;
          setText(e.target.value);
          setEditing(true);
          setOpen(true);
          setActive(-1);
          onSearch?.(e.target.value);
        }}
        onBlur={() => {
          if (!committed.current && editing) commit(text);
          committed.current = false;
        }}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-14 pl-3 text-sm text-ink placeholder:text-ink-2 focus:border-accent focus:ring-2 focus:ring-accent-soft focus:outline-none"
      />
      <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
        {loading && <Spinner className="size-3.5" />}
        {value && !editing ? (
          <button
            type="button"
            aria-label="Clear"
            className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink"
            onClick={() => onChange("")}
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Show options"
            className="rounded p-1 text-muted hover:text-ink"
            onMouseDown={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <ChevronDown className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="scroll-thin absolute z-30 mt-1 max-h-72 w-full min-w-48 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-xl"
        >
          {editing && text.trim() && !options.some((o) => o.value === text.trim()) && (
            <li
              role="option"
              aria-selected={false}
              className="cursor-pointer rounded-md px-2 py-1.5 text-sm text-accent hover:bg-surface-2"
              onMouseDown={(e) => {
                e.preventDefault();
                commit(text);
              }}
            >
              Use “{text.trim()}”
            </li>
          )}
          {matches.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={clsx(
                "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm",
                i === active ? "bg-accent-soft text-accent" : "hover:bg-surface-2",
                o.value === value && "font-medium",
              )}
              onMouseDown={(e) => {
                // Keep focus so blur doesn't commit the typed text first.
                e.preventDefault();
                commit(o.value);
                inputRef.current?.blur();
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="truncate">{o.value}</span>
              {o.count !== undefined && <span className="tabular shrink-0 text-xs text-muted">{formatInt(o.count)}</span>}
            </li>
          ))}
          {!matches.length && !(editing && text.trim()) && (
            <li className="px-2 py-1.5 text-sm text-muted">{loading ? "Loading…" : "No options"}</li>
          )}
          {options.length > MAX_SHOWN && !needle && (
            <li className="px-2 py-1 text-xs text-muted">Type to search {formatInt(options.length)} values</li>
          )}
        </ul>
      )}
    </div>
  );
}
