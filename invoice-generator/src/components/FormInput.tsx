import React from 'react';

interface FormInputProps {
  label: string;
  children: React.ReactNode;
  note?: string;
}

export const FormInput: React.FC<FormInputProps> = ({ label, children, note }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    {note && <span className="text-[11px] text-gray-400">{note}</span>}
    {children}
  </div>
);
