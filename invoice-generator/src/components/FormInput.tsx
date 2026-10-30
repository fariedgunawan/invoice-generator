import React from 'react';

interface FormInputProps {
  label: string;
  children: React.ReactNode;
  note?: string;
}

export function FormInput({ label, children, note }: FormInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700 dark:text-slate-300">{label}</label>
      {note && <span className="text-[11px] text-gray-400 dark:text-slate-500">{note}</span>}
      {children}
    </div>
  );
}
