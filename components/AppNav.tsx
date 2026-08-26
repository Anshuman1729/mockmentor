"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Start Interview" },
  { href: "/progress", label: "My Progress" },
];

// Gives the app-shell header actual navigation feedback (Nielsen's
// "visibility of system status" — a nav with no active state leaves the
// user unable to tell where they are, which reads as "not really a
// navbar" even though the links are right there) and matches the
// homepage's visual weight instead of two plain gray text links.
export default function AppNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname?.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition-colors"
                : "rounded-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-950 hover:bg-gray-100 transition-colors"
            }
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
