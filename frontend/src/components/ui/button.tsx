import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none disabled:opacity-60 disabled:pointer-events-none h-10 px-4";
    const variants: Record<Variant, string> = {
      primary: "bg-blue-600 text-white hover:bg-blue-700",
      secondary: "border border-gray-300 text-gray-800 hover:bg-gray-50",
      destructive: "bg-red-600 text-white hover:bg-red-700",
      ghost: "text-gray-800 hover:bg-gray-100",
    };
    return (
      <button
        ref={ref}
        className={clsx(base, variants[variant], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
