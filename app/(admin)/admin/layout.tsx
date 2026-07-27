import type { Metadata } from "next";
import "../../tokens.css";

export const metadata: Metadata = {
  title: "Admin",
  // The panel must never appear in an index, and never in a link preview.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Second root layout, paired with app/(public)/[locale]/layout.tsx via route
 * groups. The panel is English-only per BUILD_PLAN.md §6, so it is deliberately
 * outside the [locale] segment and carries a fixed lang attribute — running the
 * admin UI through next-intl would mean maintaining three translations of a
 * surface that exactly one person will ever see.
 */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-canvas-parchment text-ink font-text antialiased">
        {children}
      </body>
    </html>
  );
}
