import type { HTMLAttributes, ReactNode } from "react";

export function VisuallyHidden({
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, "children" | "className"> & {
  children: ReactNode;
}) {
  return (
    <div className="sr-only" {...rest}>
      {children}
    </div>
  );
}
