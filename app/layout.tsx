import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PolarisMark } from "@/components/PolarisMark";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Polaris — verify before you send",
  description:
    "Polaris kills ghost beds by verifying shelter availability before sending someone across town. Voice/SMS-first housing navigation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 border-b border-edge/70 bg-void/70 backdrop-blur-md">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
            <Link href="/" className="group flex items-center gap-2.5">
              <PolarisMark size={26} className="transition-transform group-hover:scale-110" />
              <span className="flex flex-col leading-none">
                <span className="text-[15px] font-bold tracking-[0.18em] text-ink">POLARIS</span>
                <span className="mono text-[10px] tracking-wide text-muted">verify before you send</span>
              </span>
            </Link>
            <div className="flex items-center gap-1 text-sm">
              <NavLink href="/dashboard">Live Sky</NavLink>
              <NavLink href="/provider">Provider</NavLink>
              <a
                href="#"
                className="ml-2 rounded-full border border-north/40 bg-north/10 px-3.5 py-1.5 text-[13px] font-semibold text-north transition-colors hover:bg-north/20"
              >
                Text the line
              </a>
            </div>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3.5 py-1.5 text-muted transition-colors hover:bg-white/5 hover:text-ink"
    >
      {children}
    </Link>
  );
}
