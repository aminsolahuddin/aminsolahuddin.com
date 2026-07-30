import { z } from "zod";
// Relative and extensioned, not "@/lib/locales": Node's test runner resolves
// specifiers literally and applies no tsconfig path mapping.
import { LOCALES } from "../locales.ts";
import { caveatWarnings } from "./caveats.ts";

export { caveatWarnings } from "./caveats.ts";
export type { CaveatText, FieldWarning } from "./caveats.ts";

/**
 * BUILD_PLAN.md §3, repo_entry. CLAUDE.md rule 7.
 *
 * The four caveat fields are why this section exists at all. §3 is blunt about
 * it: "A summary that only restates the README is not worth publishing — the
 * admin form should warn if not_for_you_if or the_catch is empty."
 */

/**
 * GitHub's own rules, not a guess.
 *
 * An owner is alphanumerics and single hyphens, up to 39 characters, and cannot
 * start or end with a hyphen. A repository name is looser: dots and underscores
 * are legal, which is how next.js and create-react-app both exist.
 */
export const ownerShape = z
  .string()
  .trim()
  .min(1, "An owner is required.")
  .max(39, "GitHub owners stop at 39 characters. Check the spelling.")
  .regex(
    /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d]))*$/,
    "Letters, digits and single hyphens. This is the account name from the URL, not a person's name.",
  );

export const repoNameShape = z
  .string()
  .trim()
  .min(1, "A repository name is required.")
  .max(100, "GitHub repository names stop at 100 characters.")
  .regex(
    /^[a-zA-Z\d._-]+$/,
    "Letters, digits, dots, underscores and hyphens only.",
  )
  .refine((value) => value !== "." && value !== "..", "That is not a name.");

/**
 * The canonical URL for a repo, derived rather than typed.
 *
 * §5a set this precedent for video platforms — detected from the URL, never
 * entered by hand — and the same reasoning applies harder here. A hand-entered
 * github_url can point at a different repository than the owner and name say it
 * does, and nothing would ever catch it: the page would render one repo's name
 * over another repo's link, and both halves would look right on their own.
 */
export function githubUrlFor(owner: string, name: string): string {
  return `https://github.com/${owner}/${name}`;
}

const localeEnum = z.enum(LOCALES);

/** One language's prose for an entry. Only English is ever required. */
export const repoTranslationSchema = z.object({
  locale: localeEnum,
  oneLiner: z.string().trim().max(300, "Keep the one-liner under 300 characters."),
  forWhom: z.string().trim().max(1000).optional(),
  notForYouIf: z.string().trim().max(1000).optional(),
  replaces: z.string().trim().max(1000).optional(),
  theCatch: z.string().trim().max(1000).optional(),
});

export const repoSchema = z
  .object({
    owner: ownerShape,
    name: repoNameShape,
    categoryId: z.uuid().nullable().default(null),
    status: z
      .enum(["maintained", "slowing", "archived", "superseded"])
      .default("maintained"),
    supersededByUrl: z.url("That is not a URL.").nullable().default(null),
    contentStatus: z.enum(["draft", "published"]).default("draft"),
    hasAffiliate: z.boolean().default(false),
    /** Set when the caveat warnings below have been read and accepted. */
    caveatOverride: z.boolean().default(false),
    translations: z.array(repoTranslationSchema),
  })
  .superRefine((value, ctx) => {
    const english = value.translations.find((t) => t.locale === "en");

    if (value.contentStatus === "published" && !english?.oneLiner) {
      ctx.addIssue({
        code: "custom",
        path: ["translations"],
        message: "An English one-liner is required before publishing.",
      });
    }

    /**
     * "Superseded" means something else does this better now. Publishing that
     * without saying what leaves a reader with a dead end and no way forward —
     * which is the failure §8 describes, arrived at from the other direction.
     */
    if (value.status === "superseded" && !value.supersededByUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["supersededByUrl"],
        message: "Superseded by what? A reader needs somewhere to go.",
      });
    }

    /**
     * The warnings only block publishing, never a draft save.
     *
     * A draft is unfinished by definition — refusing to save one until the
     * caveats are written means losing the half-written entry you were about to
     * finish, and the reliable way around that is to type a space into every box.
     * The gate belongs at the moment the entry becomes a public recommendation.
     */
    if (
      value.contentStatus === "published" &&
      !value.caveatOverride &&
      english &&
      caveatWarnings(english).length > 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["translations"],
        message: "This entry restates the README. Confirm to publish it anyway.",
      });
    }
  });

export type RepoInput = z.infer<typeof repoSchema>;
