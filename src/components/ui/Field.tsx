import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

import { AlertIcon } from "./icons";

const inputBase =
  "w-full rounded-xl border bg-white px-4 text-[17px] text-ink placeholder:text-muted/60 transition-colors focus:outline-none focus:ring-4";
const inputOk = "border-line focus:border-gold focus:ring-gold/20";
const inputError = "border-danger bg-danger-light/40 focus:border-danger focus:ring-danger/15";

export function fieldInputClass(error?: string, extra = "") {
  return `${inputBase} ${error ? inputError : inputOk} ${extra}`;
}

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FieldShell({ id, label, required, hint, error, children, className = "" }: FieldShellProps) {
  return (
    <div className={className} data-field-error={error ? "true" : undefined}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1 text-[15px] font-semibold text-ink">
        {label}
        {required && <span className="text-gold-dark" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-danger">
          <AlertIcon className="shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
}

export function TextField({ label, value, onChange, error, hint, required, className, id, ...props }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} required={required} hint={hint} error={error} className={className}>
      <input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={fieldInputClass(error, "h-13 min-h-[3.25rem]")}
        {...props}
      />
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
}

export function TextAreaField({ label, value, onChange, error, hint, required, className, id, ...props }: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} required={required} hint={hint} error={error} className={className}>
      <textarea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={fieldInputClass(error, "py-3 leading-relaxed resize-y")}
        {...props}
      />
    </FieldShell>
  );
}
