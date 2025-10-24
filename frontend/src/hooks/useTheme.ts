import { useEffect, useState } from 'react';

export const useTheme = () => {
    const [isDark, setIsDark] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Проверяем сохраненную тему или системную
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
        
        // Применяем тему немедленно
        if (shouldBeDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        setIsDark(shouldBeDark);
        setIsLoaded(true);
    }, []);

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        
        // Сохраняем в localStorage
        localStorage.setItem('theme', newTheme ? 'dark' : 'light');
        
        // Применяем тему
        if (newTheme) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    return { isDark, toggleTheme, isLoaded };
};
