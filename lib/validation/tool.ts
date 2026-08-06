import { z } from "zod";
// Relative and extensioned, not "@/lib/locales": Node's test runner resolves
// specifiers literally and applies no tsconfig path mapping.
import { LOCALES } from "../locales.ts";

export { toolWarnings } from "./tool-warnings.ts";
export type { ToolFacts, ToolText, ToolWarning } from "./tool-warnings.ts";

/**
 * BUILD_PLAN.md §3, `tool`. CLAUDE.md rule 7.
 *
 * Names and vendors sit on the parent row and so can never be translated —
 * `Cloudflare R2` is `Cloudflare R2` in every language. Only the two prose
 * fields have an _i18n table to live in.
 */

/**
 * A URL that a browser will actually navigate to.
 *
 * `z.url()` alone is not that. It parses with the URL constructor, and
 * `javascript:alert(1)` parses perfectly — it is a valid URL with a scheme this
 * site has no business putting in an href. These two columns are rendered as
 * links on a public page, so the scheme is checked here rather than trusted.
 */
const httpUrl = (message: string) =>
  z.url({ protocol: /^https?$/, hostname: z.regexes.domain, error: message });

export const toolNameShape = z
  .string()
  .trim()
  .min(1, "A name is required.")
  .max(80, "Keep the name under 80 characters. It is a product name, not a pitch.");

const localeEnum = z.enum(LOCALES);

/** One language's prose for a tool. Both fields are optional; see the note below. */
export const toolTranslationSchema = z.object({
  locale: localeEnum,
  whyIUseIt: z
    .string()
    .trim()
    .max(600, "Keep it under 600 characters. Longer than that is a post."),
  caveat: z.string().trim().max(600, "Keep the caveat under 600 characters."),
});

export const toolSchema = z
  .object({
    name: toolNameShape,
    vendor: z
      .string()
      .trim()
      .max(80, "Keep the vendor under 80 characters.")
      .nullable()
      .default(null),
    canonicalUrl: httpUrl(
      "That is not an http(s) URL. This is where the tool actually lives.",
    ),
    affiliateUrl: httpUrl("That is not an http(s) URL.").nullable().default(null),
    /** §3: false must render a visible marker. Honest is the whole product. */
    personallyUsed: z.boolean().default(true),
    categoryId: z.uuid().nullable().default(null),
    sortOrder: z
      .number()
      .int("Whole numbers only.")
      .min(0, "Zero or more.")
      .max(9999, "Keep it under four digits.")
      .default(0),
    /**
     * No `contentStatus`. §3 gives `tool` no status column, so saving a row is
     * publishing it — which is why nothing below refuses a save over empty
     * prose. See lib/validation/tool-warnings.ts.
     */
    translations: z.array(toolTranslationSchema),
  })
  .superRefine((value, ctx) => {
    /**
     * An affiliate URL identical to the canonical one is not an affiliate link.
     * Saving it as one sets rel="sponsored" and puts the disclosure banner on
     * /tools for a link that pays nothing — which teaches a reader that the
     * banner does not mean what it says, and that is the only thing it has.
     */
    if (value.affiliateUrl && value.affiliateUrl === value.canonicalUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["affiliateUrl"],
        message:
          "That is the canonical URL. Leave this empty if the link does not pay.",
      });
    }

    /**
     * No commission on a tool that has not been run. Settled 6 August 2026.
     *
     * The disclosure banner says "I only link tools I have used", and §3's
     * marker says "not used personally" — so the two of them appear on one
     * screen, contradicting each other, the moment a paid link lands on an
     * untested tool. Of the ways to resolve that, this is the one that matches
     * how every other rule on this site is kept: structurally. The banner is
     * automatic, `rel="sponsored"` is automatic, a published slug is permanent
     * — none of them depend on remembering, and neither does this.
     *
     * It costs nothing that matters. A tool worth naming can still be named;
     * what it cannot do is pay until it has actually been used.
     */
    if (value.affiliateUrl && !value.personallyUsed) {
      ctx.addIssue({
        code: "custom",
        path: ["affiliateUrl"],
        message:
          "No affiliate link on a tool you have not run. Tick the box above if you have, or clear this field — the banner on /tools promises exactly this.",
      });
    }
  });

export type ToolInput = z.infer<typeof toolSchema>;
