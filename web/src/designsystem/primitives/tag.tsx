import type { ComponentPropsWithoutRef } from "react";

import "./tag.css";

export type TagTone = "accent" | "accent2" | "neutral" | "outline";

const TONE_CLASS: Record<TagTone, string> = {
  accent: "ds-tag-accent",
  accent2: "ds-tag-accent-2",
  neutral: "ds-tag-neutral",
  outline: "ds-tag-outline",
};

export interface TagProps extends ComponentPropsWithoutRef<"span"> {
  tone?: TagTone;
}

/** Small tonal pill label (Organic .tag). */
export function Tag({ className, tone = "neutral", ...rest }: TagProps) {
  const classes = ["ds-tag", TONE_CLASS[tone], className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return <span className={classes} {...rest} />;
}
