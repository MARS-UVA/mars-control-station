import { useState, useEffect } from "react";

const THEMES = ["default", "dark", "colorblind"];

function ThemeToggle() {
  const [theme, setTheme] = useState("default");

  useEffect(() => {
    if (theme === "default") {
      document.body.removeAttribute("data-theme");
    } else {
      document.body.setAttribute("data-theme", theme);
    }
  }, [theme]);

  const nextTheme = () => {
    const index = THEMES.indexOf(theme);
    const nextIndex = (index + 1) % THEMES.length;
    setTheme(THEMES[nextIndex]);
  };

  return (
    <button className = "theme-button" onClick={nextTheme}>
      Theme: {theme}
    </button>
  );
}

export default ThemeToggle;
