import React from 'react';

interface DateInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  className = '',
  style,
  placeholder = 'YYYY-MM-DD'
}) => {
  const formattedForPicker = value.replace(/\//g, '-').match(/^\d{4}-\d{2}-\d{2}$/)
    ? value.replace(/\//g, '-')
    : '';

  return (
    <div className="relative flex items-center" style={style}>
      <input
        type="text"
        placeholder={placeholder}
        className={`${className} pr-10`}
        value={value}
        onChange={onChange}
      />
      <input
        type="date"
        className="absolute right-0 w-8 h-full opacity-0 cursor-pointer"
        title="Pilih dari Kalender"
        onChange={onChange}
        value={formattedForPicker}
      />
      <div className="absolute right-2.5 pointer-events-none text-gray-500">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
    </div>
  );
};
