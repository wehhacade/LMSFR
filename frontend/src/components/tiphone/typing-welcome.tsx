"use client";

import { memo, useEffect, useRef, useState } from "react";

const TYPE_MS = 58;
const DELETE_MS = 34;
const HOLD_MS = 2200;
const GAP_MS = 480;

/** Typewriter welcome line — parity with native TypingWelcome.tsx */
export const TypingWelcome = memo(function TypingWelcome({
  phrases,
  className = "",
  style,
  cursorColor,
}: {
  phrases: string[];
  className?: string;
  style?: React.CSSProperties;
  cursorColor?: string;
}) {
  const [display, setDisplay] = useState("");
  const [cursorOn, setCursorOn] = useState(true);
  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;

  useEffect(() => {
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = (delay: number, fn: () => void) => {
      timer = setTimeout(() => {
        if (!cancelled) fn();
      }, delay);
    };

    const tick = () => {
      const list = phrasesRef.current;
      if (!list.length) return;

      const full = list[phraseIndex % list.length] ?? "";

      if (!deleting) {
        if (charIndex < full.length) {
          charIndex += 1;
          setDisplay(full.slice(0, charIndex));
          schedule(TYPE_MS, tick);
          return;
        }
        schedule(HOLD_MS, () => {
          deleting = true;
          tick();
        });
        return;
      }

      if (charIndex > 0) {
        charIndex -= 1;
        setDisplay(full.slice(0, charIndex));
        schedule(DELETE_MS, tick);
        return;
      }

      deleting = false;
      phraseIndex = (phraseIndex + 1) % list.length;
      schedule(GAP_MS, tick);
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setCursorOn((on) => !on), 520);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p
      className={`mb-3.5 min-h-[26px] text-center text-[17px] font-semibold uppercase tracking-[0.14em] ${className}`}
      style={style}
    >
      {display}
      <span style={{ color: cursorColor, opacity: cursorOn ? 1 : 0 }}>|</span>
    </p>
  );
});
