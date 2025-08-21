import * as React from "react";
import { cn } from "@/lib/format";

export type CardProps = React.ComponentProps<"div">;

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200/60 dark:ring-white/10 shadow-sm",
        className
      )}
      {...props}  // <-- id, onClick, style, etc. now allowed
    />
  )
);

Card.displayName = "Card";

export { Card };
export default Card;
