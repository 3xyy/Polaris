"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Shared top bar for the marketing/demo surfaces. The dashboard is a full-screen ops center
// with its own (visually identical) bar, so we hide this there to avoid a double header.
export function SiteNav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/dashboard")) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.07] bg-white/90 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-[#111827]">
          <span className="text-[#2563EB]">✦</span> POLARIS
        </Link>
        <div className="flex items-center gap-1 text-[13px]">
          <Tab href="/dashboard" active={pathname?.startsWith("/dashboard")}>Live Sky</Tab>
          <Tab href="/provider" active={pathname?.startsWith("/provider")}>Provider</Tab>
          <Tab href="/demo" active={pathname?.startsWith("/demo")}>Try it</Tab>
        </div>
      </nav>
    </header>
  );
}

function Tab({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 transition-colors ${
        active ? "bg-[#111827] text-white" : "text-[#6B7280] hover:bg-black/[0.04] hover:text-[#111827]"
      }`}
    >
      {children}
    </Link>
  );
}
