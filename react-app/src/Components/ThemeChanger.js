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

  return (
    <div className="theme-changer">
      <label>
        <select
          value={theme} // ...force the select's value to match the state variable...
          onChange={e => setTheme(e.target.value)} // ... and update the state variable on any change!
        >
          <option value="default">Default</option>
          <option value="dark">Dark Mode</option>
          <option value="colorblind-light">Colorblind Light Mode</option>
          <option value ="colorblind-dark">Colorblind Dark Mode</option>
        </select>
      </label>
    </div>
  );
}

export default ThemeToggle;

