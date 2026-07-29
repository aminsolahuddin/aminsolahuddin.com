import { z } from "zod";
// Relative and extensioned, not "@/lib/locales": Node's test runner resolves
// specifiers literally and applies no tsconfig path mapping.
import { LOCALES } from "../locales.ts";

/**
 * CLAUDE.md rule 7: every server action validates before touching the database.
 *
 * These schemas are also the admin form's error messages, which is why the
 * messages are written for a person rather than for a log. There is exactly one
 * person who will ever read them, and he will be reading them while trying to
 * publish something.
 */

/**
 * BUILD_PLAN.md §5. A slug is spoken aloud in a video and is permanent once
 * published, so the form pushes back before that becomes true.
 *
 * The limits are guardrails, not laws — §5 says "unless overridden with a
 * confirmation", because the rule is about what usually goes wrong rather than
 * about what is always wrong. `docker-fix` is right; `nextjs-15` has a digit and
 * is still a perfectly sayable slug. So the check reports its reasons and lets
 * them be accepted deliberately, rather than silently allowing or flatly
 * refusing.
 */
export const MAX_COMFORTABLE_SLUG = 20;

export const slugShape = z
  .string()
  .trim()
  .min(1, "A slug is required.")
  .max(60, "Even overridden, a slug this long will not survive being said aloud.")
  .regex(
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
    "Lowercase letters, digits and single hyphens only. It must start with a letter.",
  );

export interface SlugWarning {
  code: "too-long" | "has-digits" | "too-many-words";
  message: string;
}

/**
 * A digit run that is not enclosed by letters on both sides.
 *
 * Written as a loop rather than a regular expression because the check is about
 * a whole run, not a single character, and the obvious regex gets that wrong in
 * a way that is easy to miss: inside "18", the character before the 8 is the 1,
 * which passes any "not a letter" test and makes i18n look like a version
 * number. Scanning runs makes the boundary explicit.
 */
function hasLooseNumber(slug: string): boolean {
  const isLetter = (char: string | undefined) =>
    char !== undefined && char >= "a" && char <= "z";

  for (const match of slug.matchAll(/\d+/g)) {
    const start = match.index;
    const end = start + match[0].length;

    const enclosed = isLetter(slug[start - 1]) && isLetter(slug[end]);
    if (!enclosed) return true;
  }

  return false;
}

/**
 * Reasons a slug is likely to fail in the one place it cannot be fixed — a video
 * that has already been published. Returns them all rather than the first, so the
 * override is a single informed decision instead of three rounds of trial.
 */
export function slugWarnings(slug: string): SlugWarning[] {
  const warnings: SlugWarning[] = [];

  if (slug.length > MAX_COMFORTABLE_SLUG) {
    warnings.push({
      code: "too-long",
      message: `${slug.length} characters. Over ${MAX_COMFORTABLE_SLUG} is hard to say once and type correctly.`,
    });
  }

  /**
   * Not "contains a digit". BUILD_PLAN.md §5 offers `next-i18n` as a good slug,
   * and a flat digit check flags it — which means the flat check is wrong rather
   * than the example.
   *
   * The distinction that matters is where the digits sit. Enclosed by letters,
   * they form a numeronym that is read as one word: i18n, a11y, k8s, l10n.
   * Standing alone or trailing, they are almost always a version — nextjs-15,
   * react-19 — and a version in a permanent URL dates it the day the next one
   * ships.
   */
  if (hasLooseNumber(slug)) {
    warnings.push({
      code: "has-digits",
      message:
        "Has a loose number. Version numbers date a permanent URL, and listeners mishear digits. Numeronyms like i18n are fine.",
    });
  }

  const words = slug.split("-").length;
  if (words > 2) {
    warnings.push({
      code: "too-many-words",
      message: `${words} words. Two is the limit that survives being said in a video.`,
    });
  }

  return warnings;
}

const localeEnum = z.enum(LOCALES);

/** One language's prose for a pack. Only English is ever required. */
export const packTranslationSchema = z.object({
  locale: localeEnum,
  title: z.string().trim().max(200, "Keep the title under 200 characters."),
  summary: z.string().trim().max(500, "Keep the summary under 500 characters.").optional(),
  notesMd: z.string().trim().max(20000).optional(),
});

export const packSchema = z
  .object({
    slug: slugShape,
    /** Set when the warnings above have been read and accepted. §5. */
    slugOverride: z.boolean().default(false),
    categoryId: z.uuid().nullable().default(null),
    videoUrl: z.url("That is not a URL.").nullable().default(null),
    repoUrl: z.url("That is not a URL.").nullable().default(null),
    status: z.enum(["draft", "published"]).default("draft"),
    hasAffiliate: z.boolean().default(false),
    translations: z.array(packTranslationSchema),
  })
  .superRefine((value, ctx) => {
    const english = value.translations.find((t) => t.locale === "en");

    /**
     * BUILD_PLAN.md §4 and §6: English is the base every other language falls
     * back to, so a published pack without it would render a fallback notice
     * pointing at a page that does not exist. A draft may be incomplete.
     */
    if (value.status === "published" && !english?.title) {
      ctx.addIssue({
        code: "custom",
        path: ["translations"],
        message: "An English title is required before publishing.",
      });
    }

    if (!value.slugOverride && slugWarnings(value.slug).length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: "This slug has warnings. Confirm to use it anyway.",
      });
    }
  });

export type PackInput = z.infer<typeof packSchema>;

export const itemSchema = z.object({
  id: z.uuid().optional(),
  kind: z.enum(["code", "file", "link", "command"]),
  url: z.url("That is not a URL.").nullable().default(null),
  body: z.string().max(50000).nullable().default(null),
  lang: z.string().trim().max(32).nullable().default(null),
  isAffiliate: z.boolean().default(false),
  translations: z.array(
    z.object({
      locale: localeEnum,
      label: z.string().trim().max(200),
      note: z.string().trim().max(1000).optional(),
    }),
  ),
});

export type ItemInput = z.infer<typeof itemSchema>;
