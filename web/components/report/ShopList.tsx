"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { hostOf } from "@/lib/format";
import type { ShopListResponse } from "@/lib/types";

type ShopRow = ShopListResponse["shops"][number];

/** `GET /shops`: every shop registered in this browser session. */
export function ShopList() {
  const toast = useToast();
  const [shops, setShops] = useState<ShopRow[]>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState<ShopRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    api.listShops()
      .then((result) => { if (alive) setShops(result.shops); })
      .catch((cause) => { if (alive) setError(errorMessage(cause, "쇼핑몰 목록을 불러오지 못했어요.")); });
    return () => { alive = false; };
  }, [attempt]);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    setRemoveError("");
    try {
      await api.deleteShop(removing.shopId);
      setShops((current) => current?.filter((shop) => shop.shopId !== removing.shopId));
      toast.show("쇼핑몰과 진단 이력을 삭제했어요");
      setRemoving(null);
    } catch (cause) {
      setRemoveError(errorMessage(cause, "쇼핑몰을 삭제하지 못했어요."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="내 쇼핑몰"
        meta={<span>이 브라우저에서 등록한 쇼핑몰이에요. 쇼핑몰을 고르면 진단 이력을 볼 수 있어요.</span>}
        actions={<ButtonLink href="/scan/new" icon="plus">새 진단</ButtonLink>}
      />
      {error ? (
        <Alert kind="error" title="쇼핑몰 목록을 불러오지 못했어요" actions={<Button variant="secondary" size="sm" icon="refresh" onClick={() => setAttempt((n) => n + 1)}>다시 불러오기</Button>}>{error}</Alert>
      ) : !shops ? (
        <div className="panel pulse" aria-busy="true" aria-label="쇼핑몰 목록을 불러오는 중" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {[0, 1, 2].map((n) => <div key={n} className="skeleton" style={{ height: 14, width: `${60 - n * 12}%` }} />)}
        </div>
      ) : !shops.length ? (
        <section className="panel" style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
          <h2 className="t-title" style={{ fontSize: 20 }}>첫 쇼핑몰을 등록해 주세요</h2>
          <p className="muted">주소를 등록하면 구매 흐름 진단을 시작할 수 있어요.</p>
          <ButtonLink href="/scan/new" icon="plus">쇼핑몰 등록하고 진단하기</ButtonLink>
        </section>
      ) : (
        <ul className="panel" style={{ listStyle: "none", margin: 0, padding: 0, overflow: "hidden" }}>
          {shops.map((shop, index) => (
            <li key={shop.shopId} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "18px 24px", borderTop: index ? "1px solid var(--line)" : 0 }}>
              <Icon name="shop" color="var(--ink-2)" />
              <span style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <Link href={`/shop/${encodeURIComponent(shop.shopId)}`} style={{ color: "var(--ink)", fontSize: 16, fontWeight: 700, textDecoration: "none" }}>{hostOf(shop.url)}</Link>
                <span className="faint" style={{ fontSize: 13, overflowWrap: "anywhere" }}>{shop.url}</span>
              </span>
              <ButtonLink variant="secondary" size="sm" href={`/shop/${encodeURIComponent(shop.shopId)}`}>진단 이력</ButtonLink>
              <Button variant="tertiary" size="sm" onClick={() => { setRemoveError(""); setRemoving(shop); }} aria-label={`${hostOf(shop.url)} 삭제`}>삭제</Button>
            </li>
          ))}
        </ul>
      )}
      {removing ? (
        <ConfirmDialog title="쇼핑몰을 삭제할까요?" confirmLabel="쇼핑몰 삭제" onCancel={() => setRemoving(null)} onConfirm={remove} busy={busy}>
          <p>{hostOf(removing.url)}의 진단 이력과 증거 이미지도 함께 지워져요. 되돌릴 수 없어요.</p>
          {removeError ? <p style={{ marginTop: 8, color: "var(--risk-ink)" }}>{removeError}</p> : null}
        </ConfirmDialog>
      ) : null}
      {toast.node}
    </>
  );
}
