"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/locales";
import { EMPTY_STATE, savePack, type FormState } from "./actions";

/**
 * The pack editor. BUILD_PLAN.md §6.
 *
 * Client-side because useActionState is what puts a validation message beside
 * the field that caused it. That is the one thing this form genuinely needs
 * interactivity for, and CLAUDE.md rule 6 asks that it be the reason rather than
 * a side effect.
 *
 * The language tabs hide panels with `hidden`, they do not unmount them. Every
 * field for every language stays in the form and posts together, so switching
 * tabs cannot lose anything typed and there is exactly one save.
 */

export interface PackFormValues {
  slug: string;
  categoryId: string | null;
  videoUrl: string | null;
  repoUrl: string | null;
  status: "draft" | "published";
  hasAffiliate: boolean;
  translations: Partial<
    Record<Locale, { title: string; summary: string; notesMd: string }>
  >;
}

const FIELD =
  "border-hairline bg-canvas text-body rounded-xs w-full border px-sm py-xs";

const LABEL = "text-caption-strong block";

export function PackForm({
  packId,
  categories,
  initial,
}: {
  packId: string | null;
  categories: { id: string; key: string; name: string }[];
  initial: PackFormValues;
}) {
  const action = savePack.bind(null, packId);
  const [state, formAction] = useActionState<FormState, FormData>(
    action,
    EMPTY_STATE,
  );
  const [tab, setTab] = useState<Locale>(DEFAULT_LOCALE);

  return (
    <form action={formAction} className="mt-xl">
      {state.errors["form"] ? (
        <p role="alert" className="text-body text-primary mb-lg">
          {state.errors["form"]}
        </p>
      ) : null}

      <div className="grid gap-lg tablet:grid-cols-2">
        <Field
          label="Slug"
          hint="Said out loud in a video. Permanent once published — a rename adds a redirect, it does not replace."
          error={state.errors["slug"]}
        >
          <input
            name="slug"
            defaultValue={initial.slug}
            required
            className={`${FIELD} font-mono`}
            placeholder="docker-fix"
          />
        </Field>

        <Field label="Category">
          <select
            name="categoryId"
            defaultValue={initial.categoryId ?? ""}
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
      </div>

      {/* §5: warnings with an override, never a refusal. The reasons sit with
          the checkbox so the confirmation is informed rather than reflexive. */}
      {state.warnings.length > 0 ? (
        <div className="border-hairline bg-surface-pearl rounded-xs mt-md border p-md">
          <p className="text-caption-strong">This slug will outlive the video.</p>
          <ul className="text-caption text-ink-muted-80 mt-xs list-disc pl-lg">
            {state.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <label className="text-caption mt-sm flex items-center gap-xs">
            <input type="checkbox" name="slugOverride" />
            Use it anyway
          </label>
        </div>
      ) : null}

      <div className="grid gap-lg tablet:grid-cols-2 mt-lg">
        <Field
          label="Video URL"
          hint="The platform is detected from the URL. There is no platform picker."
          error={state.errors["videoUrl"]}
        >
          <input
            name="videoUrl"
            defaultValue={initial.videoUrl ?? ""}
            className={FIELD}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </Field>

        <Field label="Repository URL" error={state.errors["repoUrl"]}>
          <input
            name="repoUrl"
            defaultValue={initial.repoUrl ?? ""}
            className={FIELD}
            placeholder="https://github.com/owner/name"
          />
        </Field>
      </div>

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
                {locale === DEFAULT_LOCALE ? " · required" : filled ? "" : " · empty"}
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
                  ? "Required before this pack can be published."
                  : "Leave the whole tab empty and readers get the English version with a notice."
              }
            >
              <input
                name={`title.${locale}`}
                defaultValue={initial.translations[locale]?.title ?? ""}
                className={FIELD}
              />
            </Field>

            <Field label="Summary">
              <textarea
                name={`summary.${locale}`}
                defaultValue={initial.translations[locale]?.summary ?? ""}
                rows={2}
                className={FIELD}
              />
            </Field>

            <Field label="Notes">
              <textarea
                name={`notes.${locale}`}
                defaultValue={initial.translations[locale]?.notesMd ?? ""}
                rows={6}
                className={`${FIELD} font-mono`}
              />
            </Field>
          </div>
        ))}
      </fieldset>

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
            Status
            <select
              name="status"
              defaultValue={initial.status}
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
  // `| undefined` rather than just `?`: exactOptionalPropertyTypes draws a line
  // between "this key may be absent" and "this key may hold undefined", and a
  // lookup into state.errors produces the second.
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
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
