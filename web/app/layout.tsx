import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteShell } from "../components/site-shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://product-codex-90j.pages.dev"),
  title: { default: "기도의샘물", template: "%s | 기도의샘물" },
  description: "성경말씀과 기도, 유튜브 영상, 신앙자료를 편안하게 읽고 듣는 기독교 콘텐츠 공간입니다.",
  openGraph: { type: "website", siteName: "기도의샘물", images: ["/assets/logo-sam.png"] }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ko"><body><SiteShell>{children}</SiteShell></body></html>;
}
