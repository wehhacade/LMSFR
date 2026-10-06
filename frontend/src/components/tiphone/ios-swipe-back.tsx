"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const EDGE_PX = 28;
const COMMIT_PX = 88;
const COMMIT_RATIO = 0.28;
const MAX_VERTICAL_DRIFT = 72;

type BackRegistry = {
  setHandler: (fn: (() => void) | null) => void;
};

const BackCtx = createContext<BackRegistry | null>(null);

/** Override stack back while mounted (multi-step screens, nested panels). */
export function useSwipeBackHandler(handler: (() => void) | null | undefined) {
  const ctx = useContext(BackCtx);
  useEffect(() => {
    if (!ctx) return;
    ctx.setHandler(handler ?? null);
    return () => ctx.setHandler(null);
  }, [ctx, handler]);
}

export function SwipeBackProvider({
  enabled,
  onBack,
  children,
}: {
  enabled: boolean;
  onBack: (() => void) | null;
  children: ReactNode;
}) {
  const handlerRef = useRef<(() => void) | null>(null);
  const defaultBackRef = useRef(onBack);
  defaultBackRef.current = onBack;

  const setHandler = useCallback((fn: (() => void) | null) => {
    handlerRef.current = fn;
  }, []);

  const triggerBack = useCallback(() => {
    if (handlerRef.current) {
      handlerRef.current();
      return;
    }
    defaultBackRef.current?.();
  }, []);

  return (
    <BackCtx.Provider value={{ setHandler }}>
      <SwipeBackSurface enabled={enabled && !!onBack} onBack={triggerBack}>
        {children}
      </SwipeBackSurface>
    </BackCtx.Provider>
  );
}

function SwipeBackSurface({
  enabled,
  onBack,
  children,
}: {
  enabled: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);

  const enabledRef = useRef(enabled);
  const animatingRef = useRef(animating);
  const onBackRef = useRef(onBack);
  enabledRef.current = enabled;
  animatingRef.current = animating;
  onBackRef.current = onBack;

  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const locked = useRef(false);
  const offsetRef = useRef(0);
  const widthRef = useRef(typeof window !== "undefined" ? window.innerWidth : 390);

  const setOffsetSafe = (v: number) => {
    offsetRef.current = v;
    setOffset(v);
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const reset = (animate: boolean) => {
      tracking.current = false;
      locked.current = false;
      if (!animate) {
        setAnimating(false);
        setDragging(false);
        setOffsetSafe(0);
        return;
      }
      setAnimating(true);
      setDragging(false);
      setOffsetSafe(0);
      window.setTimeout(() => setAnimating(false), 220);
    };

    const commit = () => {
      tracking.current = false;
      locked.current = false;
      setDragging(false);
      setAnimating(true);
      setOffsetSafe(widthRef.current);
      window.setTimeout(() => {
        onBackRef.current();
        setAnimating(false);
        setOffsetSafe(0);
      }, 200);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current || animatingRef.current) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_PX) return;
      widthRef.current = window.innerWidth;
      startX.current = t.clientX;
      startY.current = t.clientY;
      tracking.current = true;
      locked.current = false;
      setDragging(true);
      setAnimating(false);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking.current || !enabledRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = Math.abs(t.clientY - startY.current);

      if (!locked.current) {
        if (dy > 18 && dy > dx) {
          reset(false);
          return;
        }
        if (dx > 10) locked.current = true;
        else return;
      }

      if (dy > MAX_VERTICAL_DRIFT && dy > dx) {
        reset(true);
        return;
      }

      const next = Math.max(0, Math.min(dx, widthRef.current));
      setOffsetSafe(next);
      if (locked.current && e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!tracking.current) return;
      const dx = offsetRef.current;
      const threshold = Math.max(COMMIT_PX, widthRef.current * COMMIT_RATIO);
      if (dx >= threshold) commit();
      else reset(true);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", () => reset(false));

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const progress = Math.min(1, offset / Math.max(1, widthRef.current * 0.55));
  const shadow = offset > 0 ? Math.min(0.35, progress * 0.35) : 0;

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-dvh w-full overflow-hidden"
      style={{ touchAction: dragging ? "none" : "pan-y" }}
    >
      {offset > 0 ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `rgba(0,0,0,${0.18 * (1 - progress)})` }}
          aria-hidden
        />
      ) : null}

      <div
        className="relative min-h-dvh w-full"
        style={{
          transform: offset ? `translate3d(${offset}px, 0, 0)` : undefined,
          transition: animating
            ? "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)"
            : undefined,
          boxShadow:
            offset > 2
              ? `${-10 * progress}px 0 28px rgba(0,0,0,${shadow})`
              : undefined,
          willChange: dragging || animating ? "transform" : undefined,
        }}
      >
        {children}
      </div>

      {enabled ? (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-50 w-3"
          aria-hidden
          style={{
            background:
              offset > 0
                ? `linear-gradient(90deg, rgba(255,255,255,${0.12 * progress}), transparent)`
                : "transparent",
          }}
        />
      ) : null}
    </div>
  );
}
