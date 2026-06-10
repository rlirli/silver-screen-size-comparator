import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  // Sharp corners (rounded = 4 px), no scale bounce — opacity shift instead
  const baseStyles =
    "inline-flex items-center justify-center font-semibold rounded transition-all focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:opacity-75";

  const variants = {
    primary: "bg-brand hover:bg-brand-hover text-white",
    secondary: "bg-text-primary/6 hover:bg-text-primary/10 text-text-primary",
    outline: "border border-app-border-strong hover:bg-text-primary/4 text-text-secondary",
    ghost: "hover:bg-text-primary/5 text-text-secondary",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-sm",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
