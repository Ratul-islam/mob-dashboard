"use client";

import { useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useStoredState } from "@/lib/useStoredState";
import { IconButton } from "./ui";

type Theme = "system" | "light" | "dark";
const order: Theme[] = ["system", "light", "dark"];

export function ThemeToggle() {
  const [theme, setTheme, { loaded }] = useStoredState<Theme>("theme", "system");

  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme, loaded]);

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const next = order[(order.indexOf(theme) + 1) % order.length];
  return (
    <IconButton label={`Theme: ${theme} (switch to ${next})`} onClick={() => setTheme(next)}>
      <Icon className="size-4" />
    </IconButton>
  );
}
