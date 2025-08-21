"use client";
import { useId } from "react";

export function Switch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-labelledby={id}
      onClick={() => onCheckedChange(!checked)}
      className={`h-6 w-11 rounded-full transition-colors ${
        checked ? "bg-sky-600" : "bg-slate-300 dark:bg-slate-700"
      } relative`}
    >
      <span
        id={id}
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white dark:bg-slate-200 transition-transform ${
          checked ? "translate-x-6" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
