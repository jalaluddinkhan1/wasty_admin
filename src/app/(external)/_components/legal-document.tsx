import type { ReactNode } from "react";
import Link from "next/link";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type TocItem = { id: string; label: string };

export function LegalDocument({
  title,
  updated,
  toc,
  children,
}: {
  title: string;
  updated: string;
  toc?: readonly TocItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-muted-foreground text-sm">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span className="mx-2">/</span>
          {title}
        </p>
        <h1 className="mt-4 max-w-3xl font-semibold text-3xl tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Last updated: {updated} · Operated by GNUFOX PRIVATE LIMITED
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          {toc && toc.length > 0 ? (
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <p className="mb-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                On this page
              </p>
              <nav className="max-h-[70vh] space-y-1 overflow-y-auto text-sm">
                {toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </aside>
          ) : null}

          <article className="max-w-3xl space-y-6 text-sm leading-relaxed text-foreground/90 sm:text-base [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_h2]:scroll-mt-28 [&_h2]:mt-12 [&_h2]:border-b [&_h2]:pb-2 [&_h2]:font-semibold [&_h2]:text-xl [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-lg [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
            {children}
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
