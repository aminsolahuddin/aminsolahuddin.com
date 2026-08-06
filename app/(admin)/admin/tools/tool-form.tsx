"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/locales";
import { EMPTY_STATE, type FormState } from "@/lib/form-state";
import { toolWarnings, type ToolWarning } from "@/lib/validation/tool-warnings";
import { saveTool } from "./actions";

/**
 * The tool editor. BUILD_PLAN.md §3 and §12, Phase 4.
 *
 * Live warnings, as in the repo editor, and for the same reason: a warning that
 * only appears after a rejected save teaches you to avoid the save rather than
 * to write the sentence. Unlike that editor there is no override checkbox,
 * because none of these refuse a save — a tool row has no draft state to be
 * unfinished in, so the gate is on the public page instead. A tool with no
 * English reason is not listed there, and the warning says so in those words.
 *
 * Language tabs hide panels with `hidden` and do not unmount them, so every
 * field for every language stays in the form and posts in one save.
 */

export interface ToolTranslation {
  whyIUseIt: string;
  caveat: string;
}

export interface ToolFormValues {
  name: string;
  vendor: string | null;
  canonicalUrl: string;
  affiliateUrl: string | null;
  personallyUsed: boolean;
  categoryId: string | null;
  sortOrder: number;
  translations: Partial<Record<Locale, ToolTranslation>>;
}

const FIELD =
  "border-hairline bg-canvas text-body rounded-xs w-full border px-sm py-xs";

const EMPTY_TRANSLATION: ToolTranslation = { whyIUseIt: "", caveat: "" };

const PROSE_FIELDS = [
  {
    key: "whyIUseIt",
    label: "Why I use it",
    hint: "The reason, in your words. Without this the tool is not listed at all.",
    rows: 3,
  },
  {
    key: "caveat",
    label: "The catch",
    hint: "What it costs once you are past the first week.",
    rows: 3,
  },
] as const satisfies readonly {
  key: keyof ToolTranslation;
  label: string;
  hint: string;
  rows: number;
}[];

export function ToolForm({
  toolId,
  categories,
  initial,
}: {
  toolId: string | null;
  categories: { id: string; key: string; name: string }[];
  initial: ToolFormValues;
}) {
  const action = saveTool.bind(null, toolId);
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    EMPTY_STATE,
  );
  const [tab, setTab] = useState<Locale>(DEFAULT_LOCALE);

  /**
   * The English prose, the affiliate URL and the used-it flag are held in state
   * because the warnings read all three. Everything else stays uncontrolled —
   * there is nothing live to drive from it, and controlling it would cost a
   * re-render per keystroke to display nothing.
   */
  const [english, setEnglish] = useState<ToolTranslation>(
    initial.translations[DEFAULT_LOCALE] ?? EMPTY_TRANSLATION,
  );
  const [affiliateUrl, setAffiliateUrl] = useState(initial.affiliateUrl ?? "");
  const [personallyUsed, setPersonallyUsed] = useState(initial.personallyUsed);

  const warnings = toolWarnings(english, { personallyUsed, affiliateUrl });
  const warningFor = (field: ToolWarning["field"]): ToolWarning | undefined =>
    warnings.find((w) => w.field === field);

  const value = (name: string, loaded: string) => state.values?.[name] ?? loaded;

  /**
   * Remount on every rejected save. React 19 resets uncontrolled fields once a
   * form action settles, and `defaultValue` is only read at mount — so echoing
   * the values back does nothing on its own. Bumping a key is what makes the new
   * defaults take.
   */
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (state.values) setGeneration((n) => n + 1);
  }, [state]);

  return (
    <form key={generation} action={formAction} className="mt-xl">
      {state.errors["form"] ? (
        <p role="alert" className="text-body text-primary mb-lg">
          {state.errors["form"]}
        </p>
      ) : null}

      <div className="grid gap-lg tablet:grid-cols-2">
        <Field
          label="Name"
          hint="Exactly as the vendor spells it. Never translated."
          error={state.errors["name"]}
        >
          <input
            name="name"
            defaultValue={value("name", initial.name)}
            required
            className={FIELD}
            placeholder="Cloudflare R2"
          />
        </Field>

        <Field
          label="Vendor"
          hint="Who makes it, when that is not obvious from the name. Optional."
          error={state.errors["vendor"]}
        >
          <input
            name="vendor"
            defaultValue={value("vendor", initial.vendor ?? "")}
            className={FIELD}
            placeholder="Cloudflare"
          />
        </Field>
      </div>

      <div className="mt-lg grid gap-lg">
        <Field
          label="Canonical URL"
          hint="Where the tool actually lives. This is what the weekly link check watches."
          error={state.errors["canonicalUrl"]}
        >
          <input
            name="canonicalUrl"
            defaultValue={value("canonicalUrl", initial.canonicalUrl)}
            required
            className={`${FIELD} font-mono`}
            placeholder="https://example.com"
          />
        </Field>

        <Field
          label="Affiliate URL"
          hint="Leave empty if the link does not pay. Filling it in is what puts the disclosure banner on /tools and rel=&quot;sponsored&quot; on the link — neither is a thing to remember. Only allowed on a tool you have actually run."
          error={state.errors["affiliateUrl"]}
        >
          <input
            name="affiliateUrl"
            value={affiliateUrl}
            onChange={(e) => setAffiliateUrl(e.target.value)}
            className={`${FIELD} font-mono`}
            placeholder="https://example.com/?ref=amin"
          />
        </Field>
      </div>

      <div className="mt-lg grid gap-lg tablet:grid-cols-2">
        <Field label="Category">
          <select
            name="categoryId"
            defaultValue={value("categoryId", initial.categoryId ?? "")}
            className={FIELD}
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Sort order"
          hint="Low numbers first, within the category. Leave gaps so a tool can be slotted between two later."
          error={state.errors["sortOrder"]}
        >
          <input
            name="sortOrder"
            type="number"
            step={10}
            min={0}
            defaultValue={value("sortOrder", String(initial.sortOrder))}
            className={`${FIELD} tabular-nums`}
          />
        </Field>
      </div>

      {/* §3: personally_used = false renders a visible marker on the public
          page. The checkbox is the claim, so it says what it claims rather than
          being labelled with a column name.

          Unticking it with an affiliate URL filled in is refused by the schema,
          which is why the message below sits in the primary colour rather than
          the muted one used for the advisory warnings. */}
      <div className="border-hairline bg-surface-pearl rounded-xs mt-lg border p-md">
        <label className="text-caption-strong flex items-center gap-xs">
          <input
            type="checkbox"
            name="personallyUsed"
            checked={personallyUsed}
            onChange={(e) => setPersonallyUsed(e.target.checked)}
          />
          I have actually run this
        </label>
        <p className="text-caption text-ink-muted-80 mt-xxs">
          {personallyUsed
            ? "The page says nothing extra, which is the claim."
            : "The page will carry a marker next to the name saying you have not used it, and this tool cannot carry an affiliate link."}
        </p>
        {warningFor("personallyUsed") ? (
          <p className="text-caption text-primary mt-xs">
            {warningFor("personallyUsed")?.message}
          </p>
        ) : null}
      </div>

      <fieldset className="mt-xl">
        <legend className="text-tagline font-display">Languages</legend>

        <div role="tablist" className="mt-sm flex flex-wrap gap-xs">
          {LOCALES.map((locale) => {
            const filled =
              locale === DEFAULT_LOCALE
                ? Boolean(english.whyIUseIt)
                : Boolean(initial.translations[locale]?.whyIUseIt);

            return (
              <button
                key={locale}
                type="button"
                role="tab"
                aria-selected={tab === locale}
                onClick={() => setTab(locale)}
                className={`text-button-utility rounded-pill px-configurator-option-chip-x py-configurator-option-chip-y ${
                  tab === locale
                    ? "bg-ink text-on-dark"
                    : "border-hairline text-ink-muted-80 border"
                }`}
              >
                {locale}
                {locale === DEFAULT_LOCALE
                  ? " · required to list"
                  : filled
                    ? ""
                    : " · empty"}
              </button>
            );
          })}
        </div>

        {LOCALES.map((locale) => (
          <div key={locale} hidden={tab !== locale} className="mt-lg grid gap-lg">
            {PROSE_FIELDS.map((field) => {
              const isEnglish = locale === DEFAULT_LOCALE;
              const warning = isEnglish ? warningFor(field.key) : undefined;

              return (
                <Field
                  key={field.key}
                  label={field.label}
                  hint={field.hint}
                  warning={warning?.message}
                >
                  {isEnglish ? (
                    <textarea
                      name={`${field.key}.${locale}`}
                      value={english[field.key]}
                      onChange={(e) =>
                        setEnglish((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      rows={field.rows}
                      className={FIELD}
                    />
                  ) : (
                    <textarea
                      name={`${field.key}.${locale}`}
                      defaultValue={value(
                        `${field.key}.${locale}`,
                        initial.translations[locale]?.[field.key] ?? "",
                      )}
                      rows={field.rows}
                      className={FIELD}
                    />
                  )}
                </Field>
              );
            })}

            {locale !== DEFAULT_LOCALE ? (
              <p className="text-caption text-ink-muted-80">
                Leave the whole tab empty and readers get the English version with
                a notice. A half-filled tab is worse than an empty one.
              </p>
            ) : null}
          </div>
        ))}
      </fieldset>

      <div className="border-hairline mt-xl flex flex-wrap items-center justify-end gap-md border-t pt-lg">
        <SaveButton />
      </div>
    </form>
  );
}

function SaveButton() {
  // useFormStatus reads the parent form's pending state, which is why this is a
  // separate component — the hook returns nothing useful in the component that
  // renders the <form> itself.
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-on-primary text-body rounded-pill px-button-primary-x py-button-primary-y transition-transform duration-150 active:scale-95 disabled:opacity-60 motion-reduce:active:scale-100"
    >
      {pending ? "Saving" : "Save"}
    </button>
  );
}

function Field({
  label,
  hint,
  error,
  warning,
  children,
}: {
  label: string;
  // `| undefined` rather than just `?`: exactOptionalPropertyTypes draws a line
  // between "this key may be absent" and "this key may hold undefined", and a
  // lookup into state.errors produces the second.
  hint?: string | undefined;
  error?: string | undefined;
  warning?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-caption-strong block">{label}</span>
      {hint ? (
        <span className="text-caption text-ink-muted-80 mt-xxs block">{hint}</span>
      ) : null}
      <span className="mt-xs block">{children}</span>
      {error ? (
        <span role="alert" className="text-caption text-primary mt-xxs block">
          {error}
        </span>
      ) : null}
      {/* Not role="alert". It updates on every keystroke, and a live region that
          fires per character is unusable with a screen reader on. */}
      {warning && !error ? (
        <span className="text-caption text-ink-muted-80 mt-xxs block">
          {warning}
        </span>
      ) : null}
    </label>
  );
}
