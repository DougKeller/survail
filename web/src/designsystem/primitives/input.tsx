import type { ComponentProps, ReactNode } from "react";

import "./input.css";

function joinClasses(parts: (string | undefined)[]): string {
  return parts
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
}

export type InputProps = ComponentProps<"input">;

/** Pill text input (Organic .input). Controlled via value + onChange. */
export function Input({ className, ...rest }: InputProps) {
  return <input className={joinClasses(["ds-input", className])} {...rest} />;
}

export interface TextAreaProps extends ComponentProps<"textarea"> {
  /** Monospace body for decklist import pastes (wireframe 1c). */
  mono?: boolean;
}

/** Rounded-md multiline input. Controlled via value + onChange. */
export function TextArea({ className, mono = false, ...rest }: TextAreaProps) {
  return (
    <textarea
      className={joinClasses([
        "ds-textarea",
        mono ? "ds-textarea-mono" : undefined,
        className,
      ])}
      {...rest}
    />
  );
}

export interface FieldProps {
  children: ReactNode;
  className?: string;
  /** Optional helper text below the control. */
  hint?: ReactNode;
  /** Associates the label with the control's id. */
  htmlFor?: string;
  label: ReactNode;
}

/** Label wrapper for a form control (Organic .field). */
export function Field({
  children,
  className,
  hint,
  htmlFor,
  label,
}: FieldProps) {
  return (
    <div className={joinClasses(["ds-field", className])}>
      <label className="ds-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint !== undefined && <p className="ds-field-hint">{hint}</p>}
    </div>
  );
}
