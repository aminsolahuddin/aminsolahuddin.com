import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { listSlugTraffic } from "@/lib/queries/short-links";

export const dynamic = "force-dynamic";

export default async function TrafficPage() {
  await requireAdmin();

  const rows = await listSlugTraffic();
  const number = new Intl.NumberFormat("en");

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <p className="text-caption text-ink-muted-80">
        <Link href="/admin" className="text-primary underline underline-offset-2">
          Admin
        </Link>
      </p>
      <h1 className="text-display-md font-display mt-xxs">Short-link traffic</h1>
      <p className="text-body text-ink-muted-80 mt-xs">
        One slug per video, so this table already says which video sent the
        traffic. There is nothing to tag while recording.
      </p>

      {rows.length === 0 ? (
        <p className="text-body text-ink-muted-80 mt-xxl">
          No hits recorded yet. The first one arrives when somebody follows a
          /r/ link.
        </p>
      ) : (
        <div className="mt-xl overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-hairline border-b text-left">
                <Th>Slug</Th>
                <Th numeric>7 days</Th>
                <Th numeric>30 days</Th>
                <Th numeric>All time</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug} className="border-hairline border-b">
                  <td className="py-sm pr-md">
                    <code className="text-body font-mono">/r/{row.slug}</code>

                    {/* A renamed slug keeps receiving traffic from videos
                        published before the rename. Folding it into the new name
                        would hide the one number that says how much of the
                        audience is still on the old URL. */}
                    {row.isRedirect ? (
                      <span className="text-caption text-ink-muted-80 mt-xxs block">
                        renamed → /r/{row.resolvesTo}
                      </span>
                    ) : null}

                    {row.resolvesTo === null ? (
                      <span className="text-caption text-ink-muted-80 mt-xxs block">
                        no longer resolves
                      </span>
                    ) : null}
                  </td>
                  <Td>{number.format(row.last7)}</Td>
                  <Td>{number.format(row.last30)}</Td>
                  <Td>{number.format(row.total)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  numeric = false,
}: {
  children: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`text-caption-strong text-ink-muted-80 pb-xs font-normal ${
        numeric ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  // tabular-nums so the columns line up digit for digit rather than drifting as
  // counts change width.
  return (
    <td className="text-body py-sm pl-md text-right tabular-nums">{children}</td>
  );
}
