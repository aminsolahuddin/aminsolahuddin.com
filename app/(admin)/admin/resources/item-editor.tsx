"use client";

import { useState } from "react";

import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/locales";

/**
 * The item rows inside the pack form. BUILD_PLAN.md §6.
 *
 * Part of the same <form> as everything else, so there is one Save for the pack
 * and its items together. Splitting them would mean a half-saved pack is a state
 * that exists, and the obvious way to reach it is closing the tab between the
 * two saves.
 *
 * It shares the pack's language tab rather than carrying its own. Two tab
 * controls on one page invite the pack to be written in Malay while its items
 * stay in English, and nothing would say so.
 */

export interface EditableItem {
  /** Empty for a row added here; the database id for one that already exists. */
  id: string;
  kind: "code" | "file" | "link" | "command";
  url: string;
  body: string;
  lang: string;
  isAffiliate: boolean;
  translations: Partial<Record<Locale, { label: string; note: string }>>;
}

const KINDS = [
  { value: "code", label: "Code", hint: "A snippet, shown highlighted." },
  { value: "command", label: "Command", hint: "One line, with a copy button." },
  { value: "link", label: "Link", hint: "Somewhere else." },
  { value: "file", label: "File", hint: "A download." },
] as const;

const FIELD =
  "border-hairline bg-canvas text-body rounded-xs w-full border px-sm py-xs";

export function ItemEditor({
  tab,
  initial,
}: {
  tab: Locale;
  initial: EditableItem[];
}) {
  const [items, setItems] = useState<EditableItem[]>(initial);
  // Row identity for React keys only. Item ids are empty for new rows, and two
  // new rows would otherwise collide on the same key and swap their contents.
  const [keys, setKeys] = useState<number[]>(() => initial.map((_, i) => i));
  const [nextKey, setNextKey] = useState(initial.length);

  function add() {
    setItems((rows) => [
      ...rows,
      {
        id: "",
        kind: "link",
        url: "",
        body: "",
        lang: "",
        isAffiliate: false,
        translations: {},
      },
    ]);
    setKeys((k) => [...k, nextKey]);
    setNextKey((n) => n + 1);
  }

  function remove(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index));
    setKeys((k) => k.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;

    const swap = <T,>(list: T[]) => {
      const copy = [...list];
      const a = copy[index];
      const b = copy[target];
      if (a === undefined || b === undefined) return list;
      copy[index] = b;
      copy[target] = a;
      return copy;
    };

    setItems(swap);
    setKeys(swap);
  }

  function setKind(index: number, kind: EditableItem["kind"]) {
    setItems((rows) =>
      rows.map((row, i) => (i === index ? { ...row, kind } : row)),
    );
  }

  return (
    <section className="border-hairline mt-xxl border-t pt-lg">
      <div className="flex flex-wrap items-baseline justify-between gap-md">
        <h2 className="text-tagline font-display">Items</h2>
        <button
          type="button"
          onClick={add}
          className="text-button-utility bg-ink text-on-dark rounded-sm px-button-dark-utility-x py-button-dark-utility-y transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100"
        >
          Add item
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-caption text-ink-muted-80 mt-md">
          Nothing attached yet. A pack with no items is a page with nothing on it.
        </p>
      ) : null}

      <ul className="mt-md grid gap-lg">
        {items.map((item, index) => (
          <li
            key={keys[index]}
            className="border-hairline bg-canvas rounded-sm border p-md"
          >
            <input type="hidden" name={`items.${index}.id`} value={item.id} />

            <div className="flex flex-wrap items-center justify-between gap-sm">
              <div className="flex flex-wrap items-center gap-xs">
                {KINDS.map((k) => (
                  <label
                    key={k.value}
                    title={k.hint}
                    className={`text-button-utility rounded-pill cursor-pointer px-configurator-option-chip-x py-configurator-option-chip-y ${
                      item.kind === k.value
                        ? "bg-ink text-on-dark"
                        : "border-hairline text-ink-muted-80 border"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`items.${index}.kind`}
                      value={k.value}
                      checked={item.kind === k.value}
                      onChange={() => setKind(index, k.value)}
                      className="sr-only"
                    />
                    {k.label}
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-xxs">
                <RowButton onClick={() => move(index, -1)} label="Move up">
                  ↑
                </RowButton>
                <RowButton onClick={() => move(index, 1)} label="Move down">
                  ↓
                </RowButton>
                <RowButton onClick={() => remove(index)} label="Remove item">
                  ✕
                </RowButton>
              </div>
            </div>

            {/* Every language stays mounted, hidden rather than removed, so a
                label typed in one tab survives switching to another. */}
            {LOCALES.map((locale) => (
              <div key={locale} hidden={tab !== locale} className="mt-md grid gap-sm">
                <label className="block">
                  <span className="text-caption-strong block">
                    Label
                    {locale === DEFAULT_LOCALE ? " · required" : ""}
                  </span>
                  <input
                    name={`items.${index}.label.${locale}`}
                    defaultValue={item.translations[locale]?.label ?? ""}
                    className={`${FIELD} mt-xxs`}
                  />
                </label>

                <label className="block">
                  <span className="text-caption-strong block">Note</span>
                  <input
                    name={`items.${index}.note.${locale}`}
                    defaultValue={item.translations[locale]?.note ?? ""}
                    className={`${FIELD} mt-xxs`}
                  />
                </label>
              </div>
            ))}

            {item.kind === "link" || item.kind === "file" ? (
              <label className="mt-md block">
                <span className="text-caption-strong block">URL</span>
                <input
                  name={`items.${index}.url`}
                  defaultValue={item.url}
                  className={`${FIELD} mt-xxs`}
                  placeholder="https://"
                />
              </label>
            ) : (
              <div className="mt-md grid gap-sm">
                <label className="block">
                  <span className="text-caption-strong block">
                    {item.kind === "command" ? "Command" : "Code"}
                  </span>
                  <textarea
                    name={`items.${index}.body`}
                    defaultValue={item.body}
                    rows={item.kind === "command" ? 2 : 8}
                    className={`${FIELD} mt-xxs font-mono`}
                  />
                </label>

                {item.kind === "code" ? (
                  <label className="block">
                    <span className="text-caption-strong block">Language</span>
                    <input
                      name={`items.${index}.lang`}
                      defaultValue={item.lang}
                      className={`${FIELD} mt-xxs font-mono`}
                      placeholder="typescript"
                    />
                  </label>
                ) : null}
              </div>
            )}

            <label className="text-caption mt-md flex items-center gap-xs">
              <input
                type="checkbox"
                name={`items.${index}.isAffiliate`}
                defaultChecked={item.isAffiliate}
              />
              Affiliate link
              <span className="text-ink-muted-80">
                — adds rel=&quot;sponsored&quot; and shows the disclosure banner
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RowButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-caption text-ink-muted-80 border-hairline rounded-xs h-8 w-8 border transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100"
    >
      {children}
    </button>
  );
}
