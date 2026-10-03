import type { Metadata } from "next";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getSite } from "@/lib/sites";

export function generateMetadata(): Metadata {
  const site = getSite();
  return {
    title: site.badge ? `BlockDNS ${site.badge} — ${site.tagline}` : `BlockDNS — ${site.tagline}`,
    description: site.description,
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.localStorage.getItem("bdns-theme")==="light"){document.documentElement.classList.add("light");}else{document.documentElement.classList.remove("light");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <Providers>
          <Navbar />
          <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}