import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./variants/clean-startup.css";

export const metadata: Metadata = {
  title: { default: "바로미 | 쇼핑몰 다크패턴 사전 진단", template: "%s" },
  description: "쇼핑몰 배포 전, 구매 여정의 다크패턴 위험 신호를 객관적 근거와 함께 3분 만에 사전 점검합니다.",
  icons: {
    icon: "/brand/baromi-symbol.png",
    apple: "/brand/baromi-app-icon.png",
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/brand/baromi-symbol.png" type="image/png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
