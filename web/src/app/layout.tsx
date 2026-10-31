import type { Metadata } from "next";
import Script from "next/script";
import { Jua, Noto_Sans } from "next/font/google";
import "./globals.css";

// SERVICE_SCREEN_GUIDE 4절: Jua for titles/ranks/scores/buttons, Noto Sans for body (Latin, MVP is English).
const jua = Jua({ weight: "400", subsets: ["latin"], variable: "--font-jua" });
const notoSans = Noto_Sans({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-noto" });

// Absolute base for OG/Twitter image URLs: crawlers don't run JS and need full URLs.
// Production uses the stable production domain; previews use their own deployment URL.
const host =
  process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL;
// Cloudflare deploys: set SITE_HOST (e.g. memerush.example.workers.dev) so OG image URLs are absolute.
// Production default: without SITE_HOST the OG image URL became http://localhost:3000/... and chat apps could not load the share image (2026-10-31).
const siteHost = process.env.SITE_HOST || host || (process.env.NODE_ENV === "production" ? "memerush.superagents.run" : undefined);

export const metadata: Metadata = {
  metadataBase: new URL(siteHost ? `https://${siteHost}` : `http://localhost:${process.env.PORT ?? 3000}`),
  title: "MemeRush",
  description: "Play the Meme. Be the Meme. Beat Your Friends.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jua.variable} ${notoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Microsoft Clarity (project "Meme Rush 20261031"), production only. The id is a public site id, not a secret.
            Inputs stay masked (the email field also carries data-clarity-mask). */}
        {process.env.NODE_ENV === "production" && (
          <Script id="clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","z67hy9yusf");`}
          </Script>
        )}
      </body>
    </html>
  );
}
