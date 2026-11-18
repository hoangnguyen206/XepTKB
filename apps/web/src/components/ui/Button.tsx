/** DESIGN-M6-001 §6: every size keeps a ≥ 44 px touch target; an icon-only button must have a `label`. */
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

type Base = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};
export type ButtonProps = Base & ({ children: ReactNode; label?: string } | { children?: undefined; label: string });

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", iconOnly = false, extra?: string): string {
  return ["btn", `btn-${variant}`, size === "md" ? "" : `btn-${size}`, iconOnly ? "btn-icon-only" : "", extra ?? ""].filter(Boolean).join(" ");
}

export function Button(props: ButtonProps) {
  const { variant, size, icon, label, children, className, type, ...rest } = props;
  const iconOnly = children === undefined;
  return (
    <button
      type={type ?? "button"}
      className={buttonClass(variant, size, iconOnly, className)}
      {...(label ? { "aria-label": label } : {})}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
