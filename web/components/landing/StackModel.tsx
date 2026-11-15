"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

/**
 * The purchase flow as four stacked screens (first screen, product, cart, checkout).
 * It follows the pointer slightly; labels always face the viewer so they stay readable.
 */
const SPREAD = 78;

export function StackModel() {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !box.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = box.current.getBoundingClientRect();
    const next = { x: ((event.clientX - rect.left) / rect.width - 0.5) * 2, y: ((event.clientY - rect.top) / rect.height - 0.5) * 2 };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setTilt(next));
  }

  const rx = 56 - tilt.y * 6;
  const rz = -34 + tilt.x * 8;
  const face = `rotateZ(${-rz}deg) rotateX(${-rx}deg)`;
  const rig: CSSProperties = { transform: `rotateX(${rx}deg) rotateZ(${rz}deg) translateZ(${-1.5 * SPREAD}px)` };
  const pane = (i: number): CSSProperties => ({ transform: `translateZ(${i * SPREAD}px)` });
  // Billboarded, then pulled toward the viewer so the layer above never slices through it.
  const label: CSSProperties = { transform: `${face} translateZ(60px)` };
  const tag: CSSProperties = { transform: `translateZ(26px) ${face}` };

  return (
    <div
      ref={box}
      className="model"
      onPointerMove={move}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      role="img"
      aria-label="쇼핑몰 구매 단계를 층으로 쌓은 3D 모델. 아래부터 공개 첫 화면, 상품 상세, 장바구니, 주문서이고, 상품 상세와 주문서에 위험 의심 표시가 있어요."
    >
      <div className="model__scale">
        <div className="model__float">
          <div className="model__rig" style={rig}>
            <div className="model__shadow" />

            <div className="model__pane" style={pane(0)} aria-hidden="true">
              <div className="model__face" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[0, 1, 2, 3, 4, 5].map((n) => <div key={n} className="thumb" style={{ height: 88 }} />)}
              </div>
              <span className="model__anchor" style={label}><span className="model__label">공개 첫 화면</span></span>
            </div>

            <div className="model__pane" style={pane(1)} aria-hidden="true">
              <div className="model__face" style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 16 }}>
                <div className="thumb" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <b style={{ fontSize: 15 }}>데일리 린넨 셔츠</b>
                  <span className="tnum" style={{ fontWeight: 700 }}>29,000원</span>
                  <span className="flag flag--risk" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px" }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--ink)" }} />파손 보장 +1,500원
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px" }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, boxShadow: "inset 0 0 0 1.5px #a0a4ab" }} />선물 포장 +2,000원
                  </span>
                </div>
              </div>
              <span className="model__anchor" style={label}><span className="model__label">상품 상세 <span className="tnum faint">29,000</span></span></span>
              <span style={{ position: "absolute", right: 24, top: 40, transformStyle: "preserve-3d" }}><span className="model__tag" style={tag}>위험 의심</span></span>
            </div>

            <div className="model__pane" style={pane(2)} aria-hidden="true">
              <div className="model__face tnum" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <b style={{ fontSize: 15 }}>장바구니</b>
                <div className="money" style={{ color: "var(--ink-2)" }}><span>데일리 린넨 셔츠</span><span>29,000원</span></div>
                <div className="money" style={{ color: "var(--ink-2)" }}><span>파손 보장</span><span>1,500원</span></div>
                <div className="money money--total"><span>합계</span><span>30,500원</span></div>
              </div>
              <span className="model__anchor" style={label}><span className="model__label">장바구니 <span className="tnum faint">30,500</span></span></span>
            </div>

            <div className="model__pane" style={pane(3)} aria-hidden="true">
              <div className="model__face tnum" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <b style={{ fontSize: 15 }}>주문/결제</b>
                <div className="money" style={{ color: "var(--ink-2)" }}><span>상품과 옵션</span><span>30,500원</span></div>
                <div className="money flag flag--risk" style={{ padding: "6px 8px", margin: "0 -8px", fontWeight: 700 }}><span>필수 처리비</span><span>2,500원</span></div>
                <div className="money money--total"><span>총 결제</span><span>33,000원</span></div>
              </div>
              <span className="model__anchor" style={label}><span className="model__label">주문서 <span className="tnum faint">33,000</span></span></span>
              <span style={{ position: "absolute", right: 24, top: 120, transformStyle: "preserve-3d" }}><span className="model__tag" style={tag}>위험 의심</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
