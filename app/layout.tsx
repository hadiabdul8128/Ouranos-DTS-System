import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ouranos | Your operational workspace",
  description: "One place for the work you need to do.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
