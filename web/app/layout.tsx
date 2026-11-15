import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import "./site.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const noto = Noto_Sans_KR({ weight: ["400", "500", "600", "700", "800"], variable: "--font-noto", display: "swap", preload: false });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "바로미 | 쇼핑몰 다크패턴 진단", template: "%s | 바로미" },
  description: "쇼핑몰의 공개 화면과 구매 흐름에서 16가지 다크패턴 위험 신호를 근거와 함께 진단합니다.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${noto.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
