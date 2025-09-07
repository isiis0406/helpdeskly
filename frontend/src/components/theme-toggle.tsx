"use client"
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const el = document.documentElement
    el.classList.toggle('dark')
    setDark(el.classList.contains('dark'))
    try { localStorage.setItem('theme', el.classList.contains('dark') ? 'dark' : 'light') } catch {}
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme')
      if (stored === 'dark') document.documentElement.classList.add('dark')
    } catch {}
  }, [])

  return (
    <button onClick={toggle} className="text-sm text-muted-foreground hover:underline">
      {dark ? 'Light' : 'Dark'}
    </button>
  )
}
