import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  autoFocus?: boolean;
  id?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  debounceMs = 250,
  autoFocus = false,
  id,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value === '' && localValue !== '') {
      setLocalValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onChange(newVal);
    }, debounceMs);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange(''); 
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    inputRef.current?.focus();
  };

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={className || "w-full pl-10 pr-9 py-2.5 text-xs bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"}
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer border-0 bg-transparent"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  );
};
