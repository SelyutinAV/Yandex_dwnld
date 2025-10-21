import { LucideIcon } from 'lucide-react';
import React from 'react';

interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'success' | 'error' | 'warning';
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
        primary: 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white hover:shadow-lg hover:-translate-y-0.5 focus:ring-primary-500',
        secondary: 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 focus:ring-gray-500',
        success: 'bg-success-500 text-white hover:bg-success-600 focus:ring-success-500',
        error: 'bg-error-500 text-white hover:bg-error-600 focus:ring-error-500',
        warning: 'bg-warning-500 text-white hover:bg-warning-600 focus:ring-warning-500'
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
