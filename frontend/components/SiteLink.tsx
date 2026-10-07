import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { crossSiteHref } from "@/lib/sites";

// Renders next/link for local routes and a plain anchor for routes served by another
// BlockDNS deployment. Cross-site navigation must not go through client-side routing:
// the middleware redirect makes Next fetch a cross-origin RSC payload, which the
// browser rejects with a CORS error before falling back to a full page load.
export default function SiteLink({
  href,
  className,
  children,
  ...rest
}: {
  href: string;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">) {
  const resolved = crossSiteHref(href);

  if (resolved.startsWith("http")) {
    return (
      <a href={resolved} className={className} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link href={resolved} className={className} {...rest}>
      {children}
    </Link>
  );
}
