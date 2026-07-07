import type { Metadata, Viewport } from "next";
import "./globals.css";

// Deliberately generic: nothing over-the-shoulder readable in a browser tab.
export const metadata: Metadata = {
  title: "Correspondence",
  description: "A writing room.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
