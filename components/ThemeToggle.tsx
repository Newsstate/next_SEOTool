"use client";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") === "dark";
    setDark(saved || document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="rounded-xl border border-slate-200/70 dark:border-slate-800 px-3 py-1.5 text-sm"
      title="Toggle theme"
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}
