"use client";

import * as React from "react";

export type ToastVariant = "default" | "destructive";

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type Toast = Omit<ToastProps, "id">;

interface State {
  toasts: ToastProps[];
}

const listeners: Array<(state: State) => void> = [];
let state: State = { toasts: [] };

let counter = 0;
const genId = () => String(++counter);

function dispatch(toasts: ToastProps[]) {
  state = { toasts };
  listeners.forEach((l) => l(state));
}

export function toast(props: Toast) {
  const id = genId();
  const dismiss = () =>
    dispatch(state.toasts.map((t) => (t.id === id ? { ...t, open: false } : t)));

  dispatch([
    { ...props, id, open: true, onOpenChange: (open: boolean) => { if (!open) dismiss(); } },
    ...state.toasts.filter((t) => t.open !== false),
  ].slice(0, 3));

  setTimeout(() => dismiss(), 5000);

  return { id, dismiss };
}

export function useToast() {
  const [localState, setLocalState] = React.useState<State>(state);

  React.useEffect(() => {
    listeners.push(setLocalState);
    return () => {
      const i = listeners.indexOf(setLocalState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);

  return {
    toasts: localState.toasts,
    toast,
    dismiss: (id: string) =>
      dispatch(localState.toasts.map((t) => (t.id === id ? { ...t, open: false } : t))),
  };
}
