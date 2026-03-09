import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PrepSignals — AI Mock Interviews",
  description:
    "Practice with AI-powered mock interviews tailored to your job description. Get structured feedback and actionable improvements.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen`}
        >
          <header className="border-b bg-white px-6 py-4">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight">PrepSignals</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  AI
                </span>
              </div>
              <UserButton />
            </div>
          </header>
          <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
