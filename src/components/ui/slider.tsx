import React from "react";

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  valueSuffix?: string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  valueSuffix = "",
  className = "",
  id,
  ...props
}: SliderProps) {
  const fallbackId = React.useId();
  const generatedId = id || fallbackId;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center">
        {label && (
          <label
            htmlFor={generatedId}
            className="text-xs font-semibold uppercase tracking-wider text-text-muted"
          >
            {label}
          </label>
        )}
        <span className="text-sm font-medium text-text-secondary bg-text-primary/6 px-2 py-0.5 rounded">
          {value}
          {valueSuffix}
        </span>
      </div>
      <input
        id={generatedId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className={`w-full h-2 bg-app-border-strong rounded-lg appearance-none cursor-pointer accent-brand focus:outline-none ${className}`}
        {...props}
      />
    </div>
  );
}
