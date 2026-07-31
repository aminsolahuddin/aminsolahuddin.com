/**
 * BUILD_PLAN.md §9: "Person on /about, Article on posts, SoftwareApplication on
 * repo entries, BreadcrumbList on nested pages."
 *
 * Emitted as a JSON-LD script tag rather than microdata, because it keeps the
 * structured data out of the markup a human reads — the alternative sprinkles
 * itemprop attributes through the layout, where the next person editing the page
 * silently breaks them.
 */

const AUTHOR_NAME = "Amin Solahuddin";

export interface JsonLdSchema {
  "@context": "https://schema.org";
  [key: string]: unknown;
}

export function JsonLd({ schema }: { schema: JsonLdSchema }) {
  return (
    <script
      type="application/ld+json"
      /**
       * JSON.stringify, and the `<` escape after it.
       *
       * Everything here is server-controlled, but a title containing the literal
       * text "</script>" would close this tag early and drop the rest of the
       * object into the document as markup. Escaping the angle bracket costs
       * nothing and removes the whole class.
       */
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** §9: Article on posts. */
export function articleSchema(post: {
  title: string;
  description: string | null;
  url: string;
  publishedAt: Date | null;
  updatedAt: Date;
  locale: string;
}): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    ...(post.description ? { description: post.description } : {}),
    url: post.url,
    inLanguage: post.locale,
    ...(post.publishedAt
      ? { datePublished: post.publishedAt.toISOString() }
      : {}),
    dateModified: post.updatedAt.toISOString(),
    // Never translated, in any locale. CLAUDE.md.
    author: { "@type": "Person", name: AUTHOR_NAME },
    publisher: { "@type": "Person", name: AUTHOR_NAME },
    mainEntityOfPage: { "@type": "WebPage", "@id": post.url },
  };
}

/**
 * §9: SoftwareApplication on repo entries.
 *
 * The repo's own name and owner, never a translated string — those columns do
 * not exist on the i18n table, so there is nothing to get wrong here.
 */
export function softwareSchema(repo: {
  owner: string;
  name: string;
  description: string;
  url: string;
  githubUrl: string;
  licenseSpdx: string | null;
  locale: string;
}): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${repo.owner}/${repo.name}`,
    description: repo.description,
    url: repo.url,
    inLanguage: repo.locale,
    applicationCategory: "DeveloperApplication",
    codeRepository: repo.githubUrl,
    ...(repo.licenseSpdx ? { license: repo.licenseSpdx } : {}),
    /**
     * No aggregateRating and no ratingValue, deliberately.
     *
     * Star counts are not ratings, and mapping them onto one would put review
     * stars in a search result for a number that means "people bookmarked this".
     * That is the machine-readable version of the dishonesty this whole section
     * of the site exists to avoid.
     */
  };
}

/** §9: Person on /about. */
export function personSchema(person: {
  url: string;
  description: string;
  sameAs: string[];
}): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: AUTHOR_NAME,
    url: person.url,
    description: person.description,
    ...(person.sameAs.length > 0 ? { sameAs: person.sameAs } : {}),
  };
}

/** §9: BreadcrumbList on nested pages. */
export function breadcrumbSchema(
  crumbs: { name: string; url: string }[],
): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}
