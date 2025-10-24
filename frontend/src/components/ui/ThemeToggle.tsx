import { Moon, Sun } from 'lucide-react';
import React from 'react';
import { useTheme } from '../../hooks/useTheme';

export const ThemeToggle: React.FC = () => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`
                relative inline-flex items-center justify-center
                w-12 h-6 rounded-full transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                ${isDark ? 'bg-primary-600' : 'bg-surface-300 dark:bg-surface-600'}
            `}
            aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
        >
            <div
                className={`
                    absolute top-0.5 left-0.5 w-5 h-5 rounded-full
                    bg-white shadow-md transform transition-transform duration-200
                    flex items-center justify-center
                    ${isDark ? 'translate-x-6' : 'translate-x-0'}
                `}
            >
                {isDark ? (
                    <Moon size={12} className="text-primary-600" />
                ) : (
                    <Sun size={12} className="text-yellow-500" />
                )}
            </div>
        </button>
    );
};
