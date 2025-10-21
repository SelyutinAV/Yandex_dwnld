import { LucideIcon } from 'lucide-react';
import React from 'react';

interface StatusBadgeProps {
    status: 'connected' | 'disconnected' | 'loading' | 'error' | 'success';
    children: React.ReactNode;
    icon?: LucideIcon;
    className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    children,
    icon: Icon,
    className = ''
}) => {
    const statusClasses = {
        connected: 'bg-success-500/20 text-success-500 border-success-500/30',
        disconnected: 'bg-error-500/20 text-error-500 border-error-500/30',
        loading: 'bg-warning-500/20 text-warning-500 border-warning-500/30',
        error: 'bg-error-500/20 text-error-500 border-error-500/30',
        success: 'bg-success-500/20 text-success-500 border-success-500/30'
    };

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${statusClasses[status]} ${className}`}>
            {Icon && <Icon size={16} />}
            {children}
        </div>
    );
};
