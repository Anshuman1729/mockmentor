import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import AppNav from "@/components/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md px-4 sm:px-6 py-3.5 shadow-sm shadow-gray-100/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-gray-950">
            PrepSignals
          </Link>
          <div className="flex items-center gap-4">
            <AppNav />
            <div className="h-6 w-px bg-gray-200" aria-hidden="true" />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</main>
    </>
  );
}
