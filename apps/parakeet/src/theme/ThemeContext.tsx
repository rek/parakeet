import { createContext, useContext, useEffect, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  COLOR_SCHEMES,
  colors as defaultColors,
  type ColorScheme,
  type ThemeName,
} from './index';

const THEME_KEY = 'app_theme';

interface ThemeContextValue {
  colors: ColorScheme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: defaultColors,
  themeName: 'default',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('default');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'valkyrie') setThemeName('valkyrie');
    });
  }, []);

  function setTheme(name: ThemeName) {
    setThemeName(name);
    AsyncStorage.setItem(THEME_KEY, name);
  }

  return (
    <ThemeContext.Provider
      value={{ colors: COLOR_SCHEMES[themeName], themeName, setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
