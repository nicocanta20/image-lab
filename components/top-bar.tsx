"use client"

import { useState, useEffect } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "./theme-provider"

export function TopBar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-12 sm:h-14 flex items-center justify-between px-3 sm:px-5 bg-sand-50/80 dark:bg-[#1a1918]/80 backdrop-blur-md border-b border-sand-200/50 dark:border-white/5">
      {/* Logo / App Name */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-md bg-terracotta flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-white">
            <rect x="1" y="1" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="4" y="4" width="6" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
        <span className="font-display font-medium text-charcoal dark:text-sand-100 tracking-tight text-base sm:text-lg">
          <span className="sm:hidden">Interior</span>
          <span className="hidden sm:inline">Interior Studio</span>
        </span>
      </div>

      {/* Theme Toggle - larger touch target on mobile */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="w-10 h-10 sm:w-8 sm:h-8 -mr-1 sm:mr-0 rounded-full flex items-center justify-center text-sand-500 hover:text-charcoal dark:hover:text-sand-100 hover:bg-sand-200/50 dark:hover:bg-white/5 active:bg-sand-200 dark:active:bg-white/10 transition-colors"
        aria-label="Toggle theme"
      >
        {mounted ? (
          theme === "dark" ? (
            <Sun className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
          ) : (
            <Moon className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
          )
        ) : (
          <div className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
        )}
      </button>
    </header>
  )
}
