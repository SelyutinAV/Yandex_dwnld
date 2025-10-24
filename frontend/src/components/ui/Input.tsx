import React from 'react';

interface InputProps {
    type?: 'text' | 'number' | 'email' | 'password' | 'url';
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    error?: string;
    label?: string;
    helpText?: string;
    className?: string;
    required?: boolean;
}

export const Input: React.FC<InputProps> = ({
    type = 'text',
    placeholder,
    value,
    onChange,
    disabled = false,
    error,
    label,
    helpText,
    className = '',
    required = false
}) => {
    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    {label}
                    {required && <span className="text-error-500 ml-1">*</span>}
                </label>
            )}
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                required={required}
                className={`
                    w-full px-4 py-3 
                    bg-white dark:bg-gray-800 
                    border border-gray-300 dark:border-gray-600 
                    rounded-lg 
                    text-gray-900 dark:text-gray-100 
                    placeholder-gray-500 dark:placeholder-gray-400 
                    focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 
                    transition-all duration-200
                    ${error ? 'border-error-500 focus:border-error-500 focus:ring-error-500/20' : ''}
                `}
            />
            {error && (
                <p className="text-sm text-error-500">{error}</p>
            )}
            {helpText && !error && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{helpText}</p>
            )}
        </div>
    );
};
