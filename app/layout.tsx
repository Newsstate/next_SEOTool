import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SEO Insight (Next.js)",
  description: "Real-time SEO scan with optional JS rendering and PageSpeed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
