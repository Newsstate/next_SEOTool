// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "SEO Insight",
  description: "Real-time SEO analyzer (rendered + static)",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-black text-slate-900 dark:text-slate-100 antialiased">
        <header className="sticky top-0 z-50 backdrop-blur bg-white/70 dark:bg-black/40 border-b border-slate-200/60 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="size-8 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-black grid place-items-center font-bold">S</div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">SEO Insight</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time scans, rendered DOM compare, and PageSpeed snapshot
              </p>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="max-w-6xl mx-auto p-4">{children}</main>
        <footer className="max-w-6xl mx-auto p-6 text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} SEO Insight • Built with Next.js & Playwright
        </footer>
      </body>
    </html>
  );
}
