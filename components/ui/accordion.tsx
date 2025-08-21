"use client";
import { useState } from "react";
import { cn } from "@/lib/format";

export function Accordion({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-slate-200/70 dark:divide-slate-800", className)}>{children}</div>;
}

export function AccordionItem({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="w-full flex justify-between items-center py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium">{title}</span>
        <span className="text-slate-500">{open ? "–" : "+"}</span>
      </button>
      <div className={cn("overflow-hidden transition-[max-height] duration-300", open ? "max-h-[60rem]" : "max-h-0")}>
        <div className="pb-3">{children}</div>
      </div>
    </div>
  );
}
