"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/locales";
import { EMPTY_STATE, type FormState } from "@/lib/form-state";
import { savePost } from "./actions";

/**
 * The post editor. BUILD_PLAN.md §12, Phase 3.
 *
 * Language tabs hide panels with `hidden` rather than unmounting them, so every
 * field for every language stays in the form and posts in one save. Switching
 * tabs mid-draft cannot lose what was typed in the other one.
 */

export interface PostTranslation {
  title: string;
  excerpt: string;
  bodyMd: string;
}

export interface PostFormValues {
  slug: string;
  status: "draft" | "published";
  hasAffiliate: boolean;
  translations: Partial<Record<Locale, PostTranslation>>;
}

const FIELD =
  "border-hairline bg-canvas text-body rounded-xs w-full border px-sm py-xs";

export function PostForm({
  postId,
  initial,
}: {
  postId: string | null;
  initial: PostFormValues;
}) {
  const action = savePost.bind(null, postId);
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    EMPTY_STATE,
  );
  const [tab, setTab] = useState<Locale>(DEFAULT_LOCALE);

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

      <Field
        label="Slug"
        hint="Long and descriptive is fine here — a post slug is read and linked, not said out loud. It is still permanent once published."
        error={state.errors["slug"]}
      >
        <input
          name="slug"
          defaultValue={value("slug", initial.slug)}
          required
          className={`${FIELD} font-mono`}
          placeholder="why-the-sync-job-writes-facts-but-not-prose"
        />
      </Field>

      <fieldset className="mt-xl">
        <legend className="text-tagline font-display">Languages</legend>

        <div role="tablist" className="mt-sm flex flex-wrap gap-xs">
          {LOCALES.map((locale) => {
            const filled = Boolean(initial.translations[locale]?.title);
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
            <Field
              label="Title"
              hint={
                locale === DEFAULT_LOCALE
                  ? "Required before this post can be published."
                  : "Leave the whole tab empty and readers get the English version with a notice."
              }
            >
              <input
                name={`title.${locale}`}
                defaultValue={value(
                  `title.${locale}`,
                  initial.translations[locale]?.title ?? "",
                )}
                className={FIELD}
              />
            </Field>

            <Field
              label="Excerpt"
              hint="Shown on the index and used as the meta description. Optional."
            >
              <textarea
                name={`excerpt.${locale}`}
                defaultValue={value(
                  `excerpt.${locale}`,
                  initial.translations[locale]?.excerpt ?? "",
                )}
                rows={2}
                className={FIELD}
              />
            </Field>

            <Field
              label="Body"
              hint="Markdown. GFM tables and task lists work; fenced code blocks are highlighted. Raw HTML is stripped."
            >
              <textarea
                name={`body.${locale}`}
                defaultValue={value(
                  `body.${locale}`,
                  initial.translations[locale]?.bodyMd ?? "",
                )}
                rows={20}
                className={`${FIELD} font-mono text-caption`}
              />
            </Field>
          </div>
        ))}
      </fieldset>

      <div className="border-hairline mt-xl flex flex-wrap items-center justify-between gap-md border-t pt-lg">
        <div className="flex flex-wrap items-center gap-lg">
          {/* Rule 5. A post has no item rows to infer affiliate links from, so
              this flag is the only signal the banner has — which is why it is
              asked for directly rather than derived. */}
          <label className="text-caption flex items-center gap-xs">
            <input
              type="checkbox"
              name="hasAffiliate"
              defaultChecked={initial.hasAffiliate}
            />
            Contains affiliate links
          </label>

          <label className="text-caption flex items-center gap-xs">
            Status
            <select
              name="status"
              defaultValue={value("status", initial.status)}
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
  children,
}: {
  label: string;
  // `| undefined` rather than just `?`: exactOptionalPropertyTypes distinguishes
  // "this key may be absent" from "this key may hold undefined", and a lookup
  // into state.errors produces the second.
  hint?: string | undefined;
  error?: string | undefined;
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
    </label>
  );
}
