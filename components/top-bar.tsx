"use client"

import { useState, useRef, useEffect } from "react"
import { User, Moon, Sun, CreditCard, Settings, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "./theme-provider"
import { cn } from "@/lib/utils"

export function TopBar() {
  const { theme, setTheme } = useTheme()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3">
      {/* Left: Logo + Project Name */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-sm">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-foreground text-background">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-sm font-medium text-foreground">Untitled Project</span>
      </div>

      {/* Right: User Menu */}
      <div className="relative" ref={menuRef}>
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-full border border-border bg-card/95 backdrop-blur-md shadow-sm"
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <User className="w-5 h-5 text-muted-foreground" />
        </Button>

        {showUserMenu && (
          <div className="absolute top-full right-0 mt-2 w-56 rounded-xl bg-card border border-border shadow-xl overflow-hidden">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium text-foreground">Guest User</p>
              <p className="text-xs text-muted-foreground">Sign in for more features</p>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  <span>Theme</span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{theme}</span>
              </button>

              {/* Credits - placeholder */}
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                onClick={() => {}}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4" />
                  <span>Credits</span>
                </div>
                <span className="text-xs text-muted-foreground">50 left</span>
              </button>

              {/* Settings - placeholder */}
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                onClick={() => {}}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>

            {/* Sign Out */}
            <div className="border-t border-border py-1">
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                onClick={() => {}}
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
