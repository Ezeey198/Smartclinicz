import { Palette } from "lucide-react";
import api from "../api";
import { useAuth } from "../auth";

export const THEMES = [["teal", "Teal (default)"], ["ocean", "Ocean blue"], ["forest", "Forest green"], ["violet", "Royal purple"], ["sunset", "Sunset orange"], ["rose", "Rose"], ["slate", "Slate grey"]];

// Colour and theme for this account only. It is saved on the account, so it follows the person to any device, and nobody else's page changes.
export default function ThemePicker() {
  const { user, refresh } = useAuth();
  const change = async (e) => {
    const theme = e.target.value;
    document.documentElement.dataset.theme = theme;
    try { await api.put("/profile/theme", { theme }); refresh(); } catch { /* the colour still applies on this page */ }
  };
  return (
    <label className="theme-pick" title="Colour and theme (only for your account)">
      <Palette size={17} />
      <select value={user.theme || "teal"} onChange={change} aria-label="Colour and theme">
        {THEMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
