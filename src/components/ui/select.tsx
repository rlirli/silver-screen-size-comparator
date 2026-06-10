import React from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
}

export function Select({ label, options, className = "", id, ...props }: SelectProps) {
  const fallbackId = React.useId();
  const generatedId = id || fallbackId;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={generatedId} className="label-caps text-text-muted">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={generatedId}
          className={`w-full bg-transparent border-0 border-b border-app-border-strong py-2 pr-7 text-sm text-text-primary focus:outline-none focus:border-brand transition-colors appearance-none cursor-pointer ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-app-surface text-text-primary">
              {opt.label}
            </option>
          ))}
        </select>
        {/* Minimal chevron */}
        <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none text-text-muted">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
