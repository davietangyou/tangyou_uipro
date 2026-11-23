import type { ButtonHTMLAttributes, ReactNode } from "react";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function PrimaryButton({
  children,
  icon,
  fullWidth = true,
  className = "",
  disabled,
  ...rest
}: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={[
        "t-card inline-flex items-center justify-center gap-2 rounded-[16px]",
        "min-h-[64px] px-6 text-white",
        "transition-[transform,background-color,opacity] duration-150 ease-out",
        "enabled:active:scale-[0.96]",
        disabled
          ? "cursor-not-allowed bg-primary/40"
          : "bg-primary hover:bg-primary-pressed active:bg-primary-pressed",
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export function SecondaryButton({
  children,
  icon,
  fullWidth = false,
  className = "",
  disabled,
  ...rest
}: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={[
        "t-body inline-flex items-center justify-center gap-2 rounded-[16px]",
        "min-h-[56px] px-5 font-semibold",
        "border border-border bg-surface text-text-primary",
        "transition-[transform,background-color] duration-150 ease-out",
        "enabled:active:scale-[0.96]",
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-surface-subtle",
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export function DangerButton({
  children,
  icon,
  type = "button",
  fullWidth = false,
  className = "",
  ...rest
}: BtnProps) {
  return (
    <button
      {...rest}
      type={type}
      className={[
        "t-body inline-flex items-center justify-center gap-2 rounded-[16px]",
        "min-h-[56px] px-5 font-semibold",
        "border border-danger/30 bg-danger-surface text-danger",
        "transition-[transform,background-color] duration-150 ease-out",
        "active:scale-[0.96] hover:bg-danger/10",
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
