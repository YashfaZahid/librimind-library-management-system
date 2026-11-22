import { useId, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function TextField({ label, error, id, className, ...props }: TextFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const errorId = `${fieldId}-error`;

  return (
    <div className={className}>
      <label htmlFor={fieldId} className="block text-sm text-ink">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "mt-1.5 w-full border border-rule bg-paper-raised px-3 py-2.5 text-ink outline-none transition-colors duration-200 placeholder:text-ink-soft/70 focus:border-brass",
          error && "border-danger",
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
