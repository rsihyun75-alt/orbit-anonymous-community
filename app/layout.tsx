import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "orbit ???듬챸 而ㅻ??덊떚",
    template: "%s | orbit",
  },
  description: "濡쒓렇???놁씠 ?명븯寃??댁빞湲곕? ?섎늻???듬챸 而ㅻ??덊떚 orbit.",
  applicationName: "orbit",
  keywords: ["?듬챸 而ㅻ??덊떚", "寃뚯떆??, "?볤?", "??볤?"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e5150",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

