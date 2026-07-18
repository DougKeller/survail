import type { HTMLAttributes, Ref } from "react";

import "./card.css";

function joinClasses(parts: (string | undefined)[]): string {
  return parts
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "a" | "article" | "div";
  /** Ghost tile treatment (dashed border, e.g. the new-deck tile). */
  dashed?: boolean;
  elevation?: "lg" | "md" | "sm";
  /** Only used when as="a". */
  href?: string;
  padded?: boolean;
  /** Scroll anchors (e.g. the latest feed entry). */
  ref?: Ref<HTMLElement> | undefined;
}

/** Over-rounded surface container (Organic .card + .elev-*). */
export function Card({
  as = "div",
  children,
  className,
  dashed = false,
  elevation,
  href,
  padded = true,
  ref,
  ...rest
}: CardProps) {
  const classes = joinClasses([
    "ds-card",
    elevation !== undefined ? `ds-elev-${elevation}` : undefined,
    padded ? "ds-card-padded" : undefined,
    dashed ? "ds-card-dashed" : undefined,
    className,
  ]);
  if (as === "a") {
    return (
      <a
        className={classes}
        href={href}
        ref={ref as Ref<HTMLAnchorElement>}
        {...rest}
      >
        {children}
      </a>
    );
  }
  if (as === "article") {
    return (
      <article className={classes} ref={ref} {...rest}>
        {children}
      </article>
    );
  }
  return (
    <div className={classes} ref={ref as Ref<HTMLDivElement>} {...rest}>
      {children}
    </div>
  );
}

type SlotProps = HTMLAttributes<HTMLDivElement>;

function renderSlot(slotClass: string, { className, ...rest }: SlotProps) {
  return <div className={joinClasses([slotClass, className])} {...rest} />;
}

export interface CardTitleProps extends HTMLAttributes<HTMLElement> {
  /** Render the title as a link (deck tiles navigate from their title). */
  href?: string;
}

/** Card heading set in Caprasimo (Organic .card-title). */
export function CardTitle({
  children,
  className,
  href,
  ...rest
}: CardTitleProps) {
  if (href !== undefined) {
    return (
      <a
        className={joinClasses([
          "ds-card-title",
          "ds-card-title-link",
          className,
        ])}
        href={href}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <div className={joinClasses(["ds-card-title", className])} {...rest}>
      {children}
    </div>
  );
}

/** Padded content region inside an unpadded Card (below an Art cover). */
export function CardContent(props: SlotProps) {
  return renderSlot("ds-card-content", props);
}

/** Uppercase micro-heading above a card title (Organic .card-kicker / .k). */
export function CardKicker(props: SlotProps) {
  return renderSlot("ds-card-kicker", props);
}

/** Card body copy (Organic .card-body). */
export function CardBody(props: SlotProps) {
  return renderSlot("ds-card-body", props);
}

/** Muted footer/meta line (Organic .card-meta). The accent tone is for
    goal-gradient copy ("Drafting · 58/75 · 17 to go") per wireframe 1b. */
export function CardMeta({
  tone,
  className,
  ...rest
}: SlotProps & { tone?: "accent" | undefined }) {
  return renderSlot(
    joinClasses([
      "ds-card-meta",
      tone === "accent" ? "ds-card-meta-accent" : undefined,
    ]),
    { className, ...rest },
  );
}
