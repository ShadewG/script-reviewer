import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { ChangelogProvider } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "SCRIPT SHIELD",
  description: "True Crime Script Review Pipeline",
};

// Static string literal — no user input, safe for inline script.
// Reads localStorage theme preference before hydration to prevent flash-of-wrong-theme.
const themeInitScript = `(function(){try{var t=localStorage.getItem("script-shield-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <ChangelogProvider>{children}</ChangelogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
