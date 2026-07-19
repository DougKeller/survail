import type { ComponentPropsWithoutRef, ReactNode } from "react";

import "./choice.css";

export interface ChoiceProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "children" | "type"
> {
  label: ReactNode;
}

interface ChoiceControlProps extends ChoiceProps {
  kind: "checkbox" | "radio";
}

function ChoiceControl({
  className,
  kind,
  label,
  ...rest
}: ChoiceControlProps) {
  const classes = ["ds-choice", className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return (
    <label className={classes}>
      <input className="ds-choice-input" type={kind} {...rest} />
      <span aria-hidden="true" className="ds-choice-dot" />
      <span className="ds-choice-label">{label}</span>
    </label>
  );
}

/** Dot-style radio (Organic .radio/.dot). Controlled via checked + onChange. */
export function Radio(props: ChoiceProps) {
  return <ChoiceControl kind="radio" {...props} />;
}

/** Dot-style checkbox (Organic .radio/.dot, per wireframe 1c). */
export function Checkbox(props: ChoiceProps) {
  return <ChoiceControl kind="checkbox" {...props} />;
}

interface SegmentedOption {
  label: ReactNode;
  value: string;
}

export interface SegmentedProps {
  className?: string;
  disabled?: boolean;
  /** Accessible name for the whole group. */
  label?: string;
  /** Shared radio-group name for the underlying inputs. */
  name: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  value: string;
}

/** Pill segmented control (Organic .seg/.seg-opt) over a radio group. */
export function Segmented({
  className,
  disabled = false,
  label,
  name,
  onChange,
  options,
  value,
}: SegmentedProps) {
  const classes = ["ds-seg", className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return (
    <div
      aria-label={label}
      className={classes}
      role={label === undefined ? undefined : "group"}
    >
      {options.map((option) => (
        <label className="ds-seg-opt" key={option.value}>
          <input
            checked={option.value === value}
            className="ds-seg-input"
            disabled={disabled}
            name={name}
            onChange={() => {
              onChange(option.value);
            }}
            type="radio"
            value={option.value}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export interface SegmentedButtonsProps {
  className?: string;
  /** Accessible name for the whole group. */
  label?: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  value: string;
}

/** Segmented control over toggle buttons (aria-pressed), for view
    switchers whose contract is buttons rather than radios. */
export function SegmentedButtons({
  className,
  label,
  onChange,
  options,
  value,
}: SegmentedButtonsProps) {
  const classes = ["ds-seg", className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return (
    <div
      aria-label={label}
      className={classes}
      role={label === undefined ? undefined : "group"}
    >
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className={
            option.value === value ? "ds-seg-opt ds-seg-opt-on" : "ds-seg-opt"
          }
          key={option.value}
          onClick={() => {
            onChange(option.value);
          }}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
