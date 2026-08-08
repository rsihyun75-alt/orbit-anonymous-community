import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "orbit — 익명 커뮤니티",
    template: "%s | orbit",
  },
  description: "로그인 없이 편하게 이야기를 나누는 익명 커뮤니티 orbit.",
  applicationName: "orbit",
  keywords: ["익명 커뮤니티", "게시판", "댓글", "대댓글"],
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
