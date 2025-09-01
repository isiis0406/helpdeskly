import { clsx } from "clsx";
import { PropsWithChildren } from "react";

export function Card({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={clsx("rounded-lg border bg-white", className)}>
      {children}
    </div>
  );
}
export function CardHeader({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={clsx("p-4 border-b", className)}>{children}</div>;
}
export function CardContent({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={clsx("p-4", className)}>{children}</div>;
}
