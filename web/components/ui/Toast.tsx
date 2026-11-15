"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/** One short confirmation at the bottom of the screen; the action's own words. */
export function useToast(duration = 2600) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), duration);
  }, [duration]);
  const node = message ? <div role="status" className="toast"><Icon name="check" size={16} color="#fff" />{message}</div> : null;
  return { show, node };
}
