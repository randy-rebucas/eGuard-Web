import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Sora } from "next/font/google";
import { cookies } from "next/headers";
import { SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["500", "600", "700"] });

const description = "Digital Safety for Brighter Tomorrows. Configure, manage and verify protections on your children's devices.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description,
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_PH", title: SITE_NAME, description },
  twitter: { card: "summary_large_image" },
  // Optional: HTML-tag verification for Search Console and Bing Webmaster Tools (DNS verification needs neither)
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = (await cookies()).get("eg_theme")?.value;
  return (
    <html lang="en" className={`${hanken.variable} ${sora.variable}`} data-theme={theme === "light" || theme === "dark" ? theme : undefined} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
