import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
};

const variants = {
  primary: "bg-binding text-white hover:bg-binding-deep",
  secondary: "border border-rule bg-paper-raised text-ink hover:border-brass",
  ghost: "text-ink hover:text-binding",
};

export function Button({ variant = "primary", className, children, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium tracking-wide transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
