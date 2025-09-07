"use client";
import { Moon, SunDim } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const el = document.documentElement;
    el.classList.toggle("dark");
    setDark(el.classList.contains("dark"));
    try {
      localStorage.setItem(
        "theme",
        el.classList.contains("dark") ? "dark" : "light"
      );
    } catch {}
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "dark") document.documentElement.classList.add("dark");
    } catch {}
  }, []);

  return (
    <button
      onClick={toggle}
      className="inline-flex h-6 w-6 items-center justify-center "
      aria-label="Toggle theme"
    >
      {dark ? (
        // Sun icon (go light)
        <SunDim color="white" />
      ) : (
        // Moon icon (go dark)
        <Moon color="white" size={16} />
      )}
    </button>
  );
}
