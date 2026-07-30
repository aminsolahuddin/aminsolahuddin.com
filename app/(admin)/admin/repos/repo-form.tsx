"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/locales";
import { EMPTY_STATE, type FormState } from "@/lib/form-state";
import { caveatWarnings, type FieldWarning } from "@/lib/validation/caveats";
import { saveRepo } from "./actions";

/**
 * The repo entry editor. BUILD_PLAN.md §3.
 *
 * The caveat warnings are live rather than a response to a save. §3 asks the
 * form to warn when not_for_you_if or the_catch is empty, and a warning that
 * only appears after a rejected submit teaches you to avoid the submit, not to
 * write the sentence. So the four fields are controlled inputs, checked on every
 * keystroke, and the same function runs again on the server where it is binding.
 *
 * Language tabs hide panels with `hidden` and do not unmount them, so every
 * field for every language stays in the form and posts in one save.
 */

export interface RepoTranslation {
  oneLiner: string;
  forWhom: string;
  notForYouIf: string;
  replaces: string;
  theCatch: string;
}

export interface RepoFormValues {
  owner: string;
  name: string;
  categoryId: string | null;
  status: "maintained" | "slowing" | "archived" | "superseded";
  supersededByUrl: string | null;
  contentStatus: "draft" | "published";
  hasAffiliate: boolean;
  translations: Partial<Record<Locale, RepoTranslation>>;
}

const FIELD =
  "border-hairline bg-canvas text-body rounded-xs w-full border px-sm py-xs";

const EMPTY_TRANSLATION: RepoTranslation = {
  oneLiner: "",
  forWhom: "",
  notForYouIf: "",
  replaces: "",
  theCatch: "",
};

/** §3, in the order a reader meets them on the public page. */
const PROSE_FIELDS = [
  {
    key: "oneLiner",
    label: "One-liner",
    hint: "What it does, in a sentence someone could repeat. Required before publishing.",
    rows: 2,
  },
  {
    key: "forWhom",
    label: "Who it is for",
    hint: "The reader who should keep reading.",
    rows: 2,
  },
  {
    key: "notForYouIf",
    label: "Not for you if",
    hint: "The reader who should stop here. This is the field that makes the entry trustworthy.",
    rows: 2,
  },
  {
    key: "replaces",
    label: "Replaces",
    hint: "What they can stop using. Optional — plenty of tools replace nothing.",
    rows: 2,
  },
  {
    key: "theCatch",
    label: "The catch",
    hint: "The thing you only find out after a week with it.",
    rows: 3,
  },
] as const satisfies readonly {
  key: keyof RepoTranslation;
  label: string;
  hint: string;
  rows: number;
}[];

export function RepoForm({
  entryId,
  categories,
  initial,
}: {
  entryId: string | null;
  categories: { id: string; key: string; name: string }[];
  initial: RepoFormValues;
}) {
  const action = saveRepo.bind(null, entryId);
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    EMPTY_STATE,
  );
  const [tab, setTab] = useState<Locale>(DEFAULT_LOCALE);

  /**
   * The English prose, held in state so the warnings can track it.
   *
   * Only English. The other languages stay uncontrolled — they have no warnings
   * to drive, and controlling ten more textareas would cost a re-render per
   * keystroke to display nothing.
   */
  const [english, setEnglish] = useState<RepoTranslation>(
    initial.translations[DEFAULT_LOCALE] ?? EMPTY_TRANSLATION,
  );

  const [status, setStatus] = useState(initial.status);

  const warnings = caveatWarnings(english);
  const warningFor = (field: keyof RepoTranslation): FieldWarning | undefined =>
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
          label="Owner"
          hint="The account from the URL, exactly as GitHub spells it."
          error={state.errors["owner"]}
        >
          <input
            name="owner"
            defaultValue={value("owner", initial.owner)}
            required
            className={`${FIELD} font-mono`}
            placeholder="porsager"
          />
        </Field>

        <Field
          label="Repository"
          hint="The GitHub URL is built from these two. There is no URL field to get wrong."
          error={state.errors["name"]}
        >
          <input
            name="name"
            defaultValue={value("name", initial.name)}
            required
            className={`${FIELD} font-mono`}
            placeholder="postgres"
          />
        </Field>
      </div>

      <div className="grid gap-lg tablet:grid-cols-2 mt-lg">
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
          label="Status"
          hint="The sync job sets the first three from GitHub. Superseded is yours alone — it needs a judgement no API makes."
        >
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as RepoFormValues["status"])}
            className={FIELD}
          >
            <option value="maintained">Maintained</option>
            <option value="slowing">Slowing down</option>
            <option value="archived">Archived</option>
            <option value="superseded">Superseded</option>
          </select>
        </Field>
      </div>

      {/* Only when it applies. §8: a dead entry has to point somewhere, and an
          always-visible field for the case that is usually irrelevant reads as
          optional even when it is not. */}
      {status === "superseded" ? (
        <div className="mt-lg">
          <Field
            label="Superseded by"
            hint="Where a reader should go instead. Required — a dead end helps nobody."
            error={state.errors["supersededByUrl"]}
          >
            <input
              name="supersededByUrl"
              defaultValue={value("supersededByUrl", initial.supersededByUrl ?? "")}
              className={FIELD}
              placeholder="https://github.com/owner/name"
            />
          </Field>
        </div>
      ) : null}

      <fieldset className="mt-xl">
        <legend className="text-tagline font-display">Languages</legend>

        <div role="tablist" className="mt-sm flex flex-wrap gap-xs">
          {LOCALES.map((locale) => {
            const filled =
              locale === DEFAULT_LOCALE
                ? Boolean(english.oneLiner)
                : Boolean(initial.translations[locale]?.oneLiner);

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
                  ? " · required"
                  : filled
                    ? ""
                    : " · empty"}
              </button>
            );
          })}
        </div>

        {state.errors["translations"] ? (
          <p role="alert" className="text-caption text-primary mt-sm">
            {state.errors["translations"]}
          </p>
        ) : null}

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

      {/* §3: the four caveat fields are the whole value of this section. The
          panel is a summary of what is already marked field by field, so the
          decision to publish anyway is made in one place with all of it visible. */}
      {warnings.length > 0 ? (
        <div className="border-hairline bg-surface-pearl rounded-xs mt-xl border p-md">
          <p className="text-caption-strong">
            This entry restates the README so far.
          </p>
          <ul className="text-caption text-ink-muted-80 mt-xs list-disc pl-lg">
            {warnings.map((w) => (
              <li key={`${w.field}-${w.code}`}>
                {PROSE_FIELDS.find((f) => f.key === w.field)?.label}: {w.message}
              </li>
            ))}
          </ul>
          <label className="text-caption mt-sm flex items-center gap-xs">
            <input type="checkbox" name="caveatOverride" />
            Publish it anyway
          </label>
          <p className="text-caption text-ink-muted-80 mt-xxs">
            Saving a draft never needs this.
          </p>
        </div>
      ) : null}

      <div className="border-hairline mt-xl flex flex-wrap items-center justify-between gap-md border-t pt-lg">
        <div className="flex flex-wrap items-center gap-lg">
          <label className="text-caption flex items-center gap-xs">
            <input
              type="checkbox"
              name="hasAffiliate"
              defaultChecked={initial.hasAffiliate}
            />
            Contains affiliate links
          </label>

          <label className="text-caption flex items-center gap-xs">
            Visibility
            <select
              name="contentStatus"
              defaultValue={value("contentStatus", initial.contentStatus)}
              className="border-hairline bg-canvas rounded-xs border px-xs py-xxs"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>

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
