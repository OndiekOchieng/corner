'use client';

import * as React from 'react';

/** A titled group of related settings. */
export function SettingGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1">
      <div className="px-1">
        <h2 className="eyebrow">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
        {children}
      </div>
    </section>
  );
}

/** One row: a label/description on the left, a control on the right or below. */
export function SettingRow({
  label,
  description,
  htmlFor,
  control,
  children,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  control?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={htmlFor} className="font-medium">
            {label}
          </label>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** Accessible switch with a 44px+ hit area. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-push ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`size-6 rounded-full bg-background shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

/** Segmented choice — larger, glove-friendly targets. */
export function SegmentedChoice<T extends string | number>({
  options,
  value,
  onChange,
  format,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={String(option)}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`h-11 flex-1 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-push ${
            value === option
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-muted'
          }`}
        >
          {format ? format(option) : String(option)}
        </button>
      ))}
    </div>
  );
}
