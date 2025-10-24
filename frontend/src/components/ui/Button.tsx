import { LucideIcon } from 'lucide-react';
import React from 'react';

interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'strict';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    icon?: LucideIcon;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    children,
    onClick,
    disabled = false,
    loading = false,
    icon: Icon,
    className = '',
    type = 'button'
}) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
        primary: 'bg-primary-600 hover:bg-primary-700 text-white border border-primary-600 hover:border-primary-700 shadow-sm',
        secondary: 'bg-surface-100 hover:bg-surface-200 text-surface-800 border border-surface-300 hover:border-surface-400 shadow-sm dark:bg-surface-700 dark:hover:bg-surface-600 dark:text-surface-200 dark:border-surface-600 dark:hover:border-surface-500',
        success: 'bg-success-600 hover:bg-success-700 text-white border border-success-600 hover:border-success-700 shadow-sm',
        error: 'bg-error-600 hover:bg-error-700 text-white border border-error-600 hover:border-error-700 shadow-sm',
        warning: 'bg-warning-600 hover:bg-warning-700 text-white border border-warning-600 hover:border-warning-700 shadow-sm',
        strict: 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-500 shadow-sm'
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm gap-1.5',
        md: 'px-4 py-2 text-base gap-2',
        lg: 'px-6 py-3 text-lg gap-2'
    };

    return (
        <button
            type={type}
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
            onClick={onClick}
            disabled={disabled || loading}
        >
            {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : Icon ? (
                <Icon size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18} />
            ) : null}
            {children}
        </button>
    );
};
