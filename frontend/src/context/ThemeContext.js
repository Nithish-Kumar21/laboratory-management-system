import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeMode] = useState(() => {
        return localStorage.getItem('theme-mode') || 'system';
    });

    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const applyTheme = (mode) => {
            let dark = false;
            if (mode === 'system') {
                dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            } else {
                dark = mode === 'dark';
            }

            setIsDarkMode(dark);
            if (dark) {
                document.documentElement.classList.add('dark-mode');
            } else {
                document.documentElement.classList.remove('dark-mode');
            }
        };

        applyTheme(themeMode);
        localStorage.setItem('theme-mode', themeMode);

        if (themeMode === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = (e) => applyTheme('system');
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [themeMode]);

    const toggleTheme = () => {
        setThemeMode(prev => {
            if (prev === 'light') return 'dark';
            if (prev === 'dark') return 'system';
            return 'light';
        });
    };

    const value = {
        isDarkMode,
        themeMode,
        setThemeMode,
        toggleTheme,
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

