import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...props }: InputProps) {
  const fallbackId = React.useId();
  const generatedId = id || fallbackId;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={generatedId} className="label-caps text-text-muted">
          {label}
        </label>
      )}
      <input
        id={generatedId}
        className={`w-full bg-transparent border-0 border-b border-app-border-strong py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-brand transition-colors ${
          error ? "border-red-500 focus:border-red-500" : ""
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
    </div>
  );
}
