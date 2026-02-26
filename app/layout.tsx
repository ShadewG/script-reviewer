import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SCRIPT SHIELD",
  description: "True Crime Script Review Pipeline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
