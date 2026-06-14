"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PolarisMark } from "@/components/PolarisMark";

// Global top nav for the marketing/demo surfaces. The dashboard is a full-screen ops center
// with its own chrome, so we hide this there.
export function SiteNav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/dashboard")) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-edge/70 bg-void/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <PolarisMark size={24} className="transition-transform group-hover:scale-110" />
          <span className="text-[15px] font-bold tracking-[0.18em] text-ink">POLARIS</span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <NavLink href="/dashboard">Live Sky</NavLink>
          <NavLink href="/provider">Provider</NavLink>
          <Link
            href="/demo"
            className="ml-2 rounded-full border border-north/40 bg-north/10 px-3.5 py-1.5 text-[13px] font-semibold text-north transition-colors hover:bg-north/20"
          >
            Try it ★
          </Link>
        </div>
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-full px-3.5 py-1.5 text-muted transition-colors hover:bg-white/5 hover:text-ink">
      {children}
    </Link>
  );
}
