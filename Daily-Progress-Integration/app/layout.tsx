import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Site Diary | Daily Progress",
  description: "Contractor material issues, daily consumption and manpower reports.",
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
