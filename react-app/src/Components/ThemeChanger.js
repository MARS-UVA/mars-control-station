import { useState, useEffect } from "react";
import { Palette } from "lucide-react";

function ThemeToggle() {
  const [theme, setTheme] = useState("default");

  useEffect(() => {
    if (theme === "default") {
      document.body.removeAttribute("data-theme");
    } else {
      document.body.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return (
    <div className="theme-changer">
      <Palette size={13} className="theme-changer__icon" />
      <select
        className="theme-changer__select"
        value={theme}
        onChange={e => setTheme(e.target.value)}
      >
        <option value="default">Light</option>
        <option value="dark">Dark</option>
        <option value="colorblind-light">Colorblind Light</option>
        <option value="colorblind-dark">Colorblind Dark</option>
      </select>
    </div>
  );
}

export default ThemeToggle;
