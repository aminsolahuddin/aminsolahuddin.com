import { Prose } from "@/components/prose";

/**
 * The shell for a page whose whole content is one piece of prose — disclosure,
 * privacy, about. BUILD_PLAN.md §10.
 *
 * The copy lives in messages/{locale}.json rather than in the database, because
 * these are policy rather than content. A policy that can be edited from the
 * admin panel is one that can be quietly edited from the admin panel, and the
 * point of §10's disclosure page is that its history is auditable. Here, changing
 * it is a commit with a date on it.
 *
 * That also means the existing translation fallback applies unchanged: ms.json
 * and zh-Hans.json omit these keys, i18n/request.ts merges English underneath,
 * and the notice at the top says so.
 */
export function StaticPage({
  title,
  lead,
  body,
  meta,
}: {
  title: string;
  lead: string;
  body: string;
  meta?: string | undefined;
}) {
  return (
    <article className="mx-auto max-w-3xl px-lg py-xxl">
      <header>
        <h1 className="text-display-lg font-display text-balance">{title}</h1>
        <p className="text-lead-airy text-ink-muted-80 mt-md text-pretty">
          {lead}
        </p>
        {meta ? (
          <p className="text-caption text-ink-muted-80 mt-lg">{meta}</p>
        ) : null}
      </header>

      <div className="border-hairline mt-xl border-t pt-xl">
        <Prose source={body} />
      </div>
    </article>
  );
}
