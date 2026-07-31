import { z } from "zod";
// Relative and extensioned, not "@/lib/locales": Node's test runner resolves
// specifiers literally and applies no tsconfig path mapping.
import { LOCALES } from "../locales.ts";
import { slugShape } from "./pack.ts";

/**
 * BUILD_PLAN.md §3, post. CLAUDE.md rule 7.
 *
 * A post slug reuses the pack slug's *shape* but not its warnings. §5's rules —
 * two words, no version numbers, short enough to say out loud — exist because a
 * pack slug is spoken in a video. A post slug is read, linked and searched, so
 * "why-the-sync-job-writes-facts-but-not-prose" is a good one and would collect
 * three warnings under the other rules.
 *
 * What it keeps is permanence. A published post URL gets linked from elsewhere,
 * and CLAUDE.md rule 3's reasoning applies to anything that has been public.
 */
export const postSlugShape = slugShape;

/** One language's prose. Only English is ever required. */
export const postTranslationSchema = z.object({
  locale: z.enum(LOCALES),
  title: z.string().trim().max(200, "Keep the title under 200 characters."),
  excerpt: z
    .string()
    .trim()
    .max(500, "Keep the excerpt under 500 characters.")
    .optional(),
  bodyMd: z.string().trim().max(200_000).optional(),
});

export const postSchema = z
  .object({
    slug: postSlugShape,
    status: z.enum(["draft", "published"]).default("draft"),
    hasAffiliate: z.boolean().default(false),
    translations: z.array(postTranslationSchema),
  })
  .superRefine((value, ctx) => {
    const english = value.translations.find((t) => t.locale === "en");

    /**
     * English is the base every other language falls back to under §6, so a
     * published post without it would render a fallback notice pointing at a
     * page that does not exist. A draft may be as incomplete as it likes.
     */
    if (value.status === "published" && !english?.title) {
      ctx.addIssue({
        code: "custom",
        path: ["translations"],
        message: "An English title is required before publishing.",
      });
    }

    /**
     * And a body. A published post with a title and nothing under it is a link
     * that goes nowhere — the same dead end §8 is about, reached from the other
     * side. The excerpt stays optional because the index can fall back to the
     * title alone.
     */
    if (value.status === "published" && !english?.bodyMd) {
      ctx.addIssue({
        code: "custom",
        path: ["translations"],
        message: "There is no English body to publish.",
      });
    }
  });

export type PostInput = z.infer<typeof postSchema>;
