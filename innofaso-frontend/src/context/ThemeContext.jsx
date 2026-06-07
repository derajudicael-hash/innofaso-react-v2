import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("innofaso_theme") || "blanc";
    document.body.setAttribute("data-theme", saved);
    return saved;
  });

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("innofaso_theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
