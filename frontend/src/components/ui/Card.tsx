import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: 'sm' | 'md' | 'lg';
    hover?: boolean;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    padding = 'md',
    hover = false,
    onClick
}) => {
    const paddingClasses = {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8'
    };

    const hoverClasses = hover ? 'hover:shadow-soft-lg hover:-translate-y-1 transition-all duration-200' : '';
    const clickableClasses = onClick ? 'cursor-pointer' : '';

    return (
        <div
            className={`card ${paddingClasses[padding]} ${hoverClasses} ${clickableClasses} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};
