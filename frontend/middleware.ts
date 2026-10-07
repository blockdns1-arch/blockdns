import { NextResponse, type NextRequest } from "next/server";

const MAIN = "https://blockdns-home.vercel.app";
const EXPLORER = "https://blockdns-explorer.vercel.app";
const FOUNDATION = "https://blockdns-founder.vercel.app";
const SWAP = "https://blockdns-swap.vercel.app";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hostname = req.nextUrl.hostname;

  const hostedSite =
    hostname === "blockdns-explorer.vercel.app"
      ? "/explorer"
      : hostname === "blockdns-swap.vercel.app"
        ? "/swap"
        : hostname === "blockdns-founder.vercel.app"
          ? "/foundation"
          : null;

  if (hostedSite) {
    const allowed =
      (hostedSite === "/explorer" && pathname.startsWith("/explorer")) ||
      (hostedSite === "/foundation" &&
        (pathname.startsWith("/foundation") || pathname.startsWith("/whitepaper"))) ||
      (hostedSite === "/swap" &&
        (pathname.startsWith("/swap") ||
          pathname.startsWith("/bridge") ||
          pathname.startsWith("/staking")));

    if (pathname === "/") {
      const rewriteUrl = req.nextUrl.clone();
      rewriteUrl.pathname = hostedSite;
      return NextResponse.rewrite(rewriteUrl);
    }

    if (allowed) return NextResponse.next();
    return NextResponse.redirect(new URL("/", req.url));
  }

  const port = req.nextUrl.port || "3000";

  const siteHome: Record<string, string> = {
    "3001": "/explorer",
    "3002": "/foundation",
    "3003": "/swap",
  };
  const home: Record<string, string> = {
    "3001": EXPLORER,
    "3002": FOUNDATION,
    "3003": SWAP,
  };

  if (port === "3001" || port === "3002" || port === "3003") {
    const allowed =
      port === "3001"
        ? pathname.startsWith("/explorer")
        : port === "3002"
          ? pathname.startsWith("/foundation") || pathname.startsWith("/whitepaper")
          : pathname.startsWith("/swap") ||
            pathname.startsWith("/bridge") ||
            pathname.startsWith("/staking");
    if (allowed) return NextResponse.next();
    return NextResponse.redirect(new URL(siteHome[port], home[port]));
  }

  const to = (target: string) =>
    NextResponse.redirect(new URL(pathname, target));

  if (pathname.startsWith("/explorer")) return to(EXPLORER);
  if (pathname.startsWith("/foundation")) return to(FOUNDATION);
  if (pathname.startsWith("/swap") || pathname.startsWith("/bridge"))
    return to(SWAP);
  if (pathname.startsWith("/staking")) return to(SWAP);
  if (pathname.startsWith("/whitepaper"))
    return NextResponse.redirect(`${MAIN}/#whitepaper`);

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.*|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
