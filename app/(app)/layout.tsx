import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-gray-950">
            PrepSignals
          </Link>
          <UserButton />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</main>
    </>
  );
}
