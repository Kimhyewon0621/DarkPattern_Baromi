import type { Metadata } from "next";
import { ShopHistory } from "@/components/report/ShopHistory";

export const metadata: Metadata = { title: "진단 이력" };

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShopHistory shopId={id} />;
}
