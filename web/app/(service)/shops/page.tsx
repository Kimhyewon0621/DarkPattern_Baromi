import type { Metadata } from "next";
import { ShopList } from "@/components/report/ShopList";

export const metadata: Metadata = { title: "내 쇼핑몰" };

export default function ShopsPage() {
  return <ShopList />;
}
