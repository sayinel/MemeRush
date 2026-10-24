import type { Metadata } from "next";
import { Jua, Noto_Sans } from "next/font/google";
import "./globals.css";

// SERVICE_SCREEN_GUIDE 4절: Jua for titles/ranks/scores/buttons, Noto Sans for body (Latin, MVP is English).
const jua = Jua({ weight: "400", subsets: ["latin"], variable: "--font-jua" });
const notoSans = Noto_Sans({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-noto" });

export const metadata: Metadata = {
  title: "MemeRush",
  description: "Play the Meme. Be the Meme. Beat Your Friends.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jua.variable} ${notoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
