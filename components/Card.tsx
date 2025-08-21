// components/card.tsx
import * as React from "react";
import { cn } from "@/lib/format";

export type CardProps = React.ComponentPropsWithoutRef<"div">;

const base =
  "rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200/60 dark:ring-white/10 shadow-sm";

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(base, className)} {...props} />
  )
);

Card.displayName = "Card";

export { Card };
export default Card;
