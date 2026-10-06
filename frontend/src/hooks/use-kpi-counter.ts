import { useEffect, useMemo, useRef, useState } from "react";

export function fmtNum(value: number | null | undefined): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "0";
}

/**
 * Animated KPI counter. Keeps display values aligned with targets on every
 * render — the old version only initialized state once, so when targets grew
 * after loading (e.g. [] → 4 KPIs) kpiVals[i] was undefined and crashed.
 */
export function useKpiCounter(targets: Array<number | null | undefined>) {
  const safeTargets = useMemo(
    () => targets.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targets.join(",")],
  );
  const key = safeTargets.join(",");
  const [vals, setVals] = useState<number[]>(() => safeTargets.map(() => 0));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!safeTargets.length) {
      setVals([]);
      return;
    }
    const dur = 1200;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVals(safeTargets.map((v) => Math.round(v * e)));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [key, safeTargets]);

  if (vals.length !== safeTargets.length) {
    return safeTargets.map(() => 0);
  }
  return vals;
}
