"use client"

import { useState, useRef, useEffect } from "react"
import type { GenerationSettings } from "./SimpleRoomDesigner"
import { Loader2, SlidersHorizontal, ArrowRight, Sun, Palette, Maximize, RatioIcon } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PromptInputProps {
  prompt: string
  setPrompt: (prompt: string) => void
  settings: GenerationSettings
  setSettings: (settings: GenerationSettings) => void
  onGenerate: () => void
  isGenerating: boolean
  isAnalyzing?: boolean
  canGenerate: boolean
  generationMode: "create" | "edit" | "add-references"
  compact?: boolean
}

const STYLE_OPTIONS = [
  { value: "photorealistic", label: "Photorealistic" },
  { value: "modern-minimal", label: "Modern Minimal" },
  { value: "scandinavian", label: "Scandinavian" },
  { value: "mid-century", label: "Mid-Century Modern" },
  { value: "industrial", label: "Industrial Loft" },
  { value: "bohemian", label: "Bohemian" },
  { value: "coastal", label: "Coastal" },
  { value: "traditional", label: "Traditional" },
  { value: "art-deco", label: "Art Deco" },
  { value: "japandi", label: "Japandi" },
]

const LIGHTING_OPTIONS = [
  { value: "natural-daylight", label: "Natural Daylight" },
  { value: "golden-hour", label: "Golden Hour" },
  { value: "soft-ambient", label: "Soft Ambient" },
  { value: "dramatic", label: "Dramatic" },
  { value: "warm-evening", label: "Warm Evening" },
  { value: "cool-morning", label: "Cool Morning" },
  { value: "studio", label: "Studio Lighting" },
  { value: "moody", label: "Moody & Dark" },
]

const RESOLUTION_OPTIONS = [
  { value: "1K", label: "1K (1024px)" },
  { value: "2K", label: "2K (2048px)" },
  { value: "4K", label: "4K (4096px)", note: "2x cost" },
]

const ASPECT_RATIO_OPTIONS = [
  // Default
  { value: "auto", label: "Auto", w: 16, h: 12 },
  { value: "1:1", label: "Square", w: 14, h: 14 },
  // Landscape (common → extreme)
  { value: "4:3", label: "Classic", w: 16, h: 12 },
  { value: "3:2", label: "Photo", w: 15, h: 10 },
  { value: "16:9", label: "Video", w: 16, h: 9 },
  { value: "21:9", label: "Ultrawide", w: 21, h: 9 },
  // Portrait (mirrors)
  { value: "3:4", label: "Portrait", w: 12, h: 16 },
  { value: "2:3", label: "Photo Portrait", w: 10, h: 15 },
  { value: "9:16", label: "Vertical", w: 9, h: 16 },
]

function AspectRatioIcon({ w, h, className }: { w: number; h: number; className?: string }) {
  const scale = 12 / Math.max(w, h)
  const width = w * scale
  const height = h * scale
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className={className}>
      <rect
        x={(18 - width) / 2}
        y={(18 - height) / 2}
        width={width}
        height={height}
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function PromptInput({
  prompt,
  setPrompt,
  settings,
  setSettings,
  onGenerate,
  isGenerating,
  isAnalyzing = false,
  canGenerate,
  generationMode,
  compact = false,
}: PromptInputProps) {
  const isLoading = isGenerating || isAnalyzing
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isMultiline, setIsMultiline] = useState(false)
  const [mounted, setMounted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Prevent hydration mismatch from Radix UI generating different IDs on server vs client
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && canGenerate && !isLoading) {
      e.preventDefault()
      onGenerate()
    }
  }

  // Auto-resize textarea and detect multiline
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to measure actual content
    textarea.style.height = "auto"
    const scrollHeight = textarea.scrollHeight
    const lineHeight = 20 // approximate line height
    const lines = Math.ceil(scrollHeight / lineHeight)

    // Cap at max height (roughly 5 lines)
    const maxHeight = compact ? 80 : 120
    const newHeight = Math.min(scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`

    // Detect if we have more than ~1.5 lines of content
    setIsMultiline(!compact && lines > 2)
  }, [prompt, compact])

  const currentStyle = STYLE_OPTIONS.find(s => s.value === settings.style)?.label || "Photorealistic"
  const currentLighting = LIGHTING_OPTIONS.find(l => l.value === settings.lighting)?.label || "Natural Daylight"
  const currentResolution = settings.resolution || "1K"
  const currentAspectRatio = settings.aspectRatio === "auto" ? "Auto" : settings.aspectRatio || "Auto"

  // Dynamic placeholder based on mode
  const placeholder = {
    create: "Describe the room you want to create...",
    edit: "Describe changes (e.g., 'change walls to blue')...",
    "add-references": "Additional instructions (optional)...",
  }[generationMode]

  // Dynamic helper text based on mode
  const helperText = {
    create: "Enter a prompt to generate a new room",
    edit: "Enter a prompt to modify the room",
    "add-references": canGenerate ? "" : "Add reference images to generate",
  }[generationMode]

  // Settings popover content (shared between layouts)
  // Only render Popover after mount to prevent Radix ID hydration mismatch
  const settingsPopover = mounted ? (
    <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`
            ${compact ? "p-2" : "p-2.5"} rounded-lg transition-all duration-200
            ${settingsOpen
              ? "bg-sand-100 dark:bg-sand-500/20 text-charcoal dark:text-sand-100"
              : "text-sand-400 hover:text-charcoal dark:hover:text-sand-100 hover:bg-sand-100 dark:hover:bg-sand-500/10"
            }
          `}
          title="Generation settings"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-56 p-3 border-sand-200 dark:border-sand-500/30 bg-white dark:bg-[#1f1e1d] shadow-xl"
      >
        <div className="space-y-4">
          {/* Style */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-sand-500 dark:text-sand-400">
              <Palette className="w-3 h-3" />
              Style
            </label>
            <Select
              value={settings.style}
              onValueChange={(value) =>
                setSettings({ ...settings, style: value })
              }
            >
              <SelectTrigger className="w-full h-9 bg-sand-50 dark:bg-sand-500/10 border-sand-200 dark:border-sand-500/30 rounded-lg text-sm text-charcoal dark:text-sand-100 focus:ring-terracotta/30 focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1f1e1d] border-sand-200 dark:border-sand-500/30">
                {STYLE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-sm text-charcoal dark:text-sand-100 focus:bg-sand-100 dark:focus:bg-sand-500/20"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lighting */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-sand-500 dark:text-sand-400">
              <Sun className="w-3 h-3" />
              Lighting
            </label>
            <Select
              value={settings.lighting}
              onValueChange={(value) =>
                setSettings({ ...settings, lighting: value })
              }
            >
              <SelectTrigger className="w-full h-9 bg-sand-50 dark:bg-sand-500/10 border-sand-200 dark:border-sand-500/30 rounded-lg text-sm text-charcoal dark:text-sand-100 focus:ring-terracotta/30 focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1f1e1d] border-sand-200 dark:border-sand-500/30">
                {LIGHTING_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-sm text-charcoal dark:text-sand-100 focus:bg-sand-100 dark:focus:bg-sand-500/20"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resolution */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-sand-500 dark:text-sand-400">
              <Maximize className="w-3 h-3" />
              Resolution
            </label>
            <Select
              value={settings.resolution}
              onValueChange={(value: "1K" | "2K" | "4K") =>
                setSettings({ ...settings, resolution: value })
              }
            >
              <SelectTrigger className="w-full h-9 bg-sand-50 dark:bg-sand-500/10 border-sand-200 dark:border-sand-500/30 rounded-lg text-sm text-charcoal dark:text-sand-100 focus:ring-terracotta/30 focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1f1e1d] border-sand-200 dark:border-sand-500/30">
                {RESOLUTION_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-sm text-charcoal dark:text-sand-100 focus:bg-sand-100 dark:focus:bg-sand-500/20"
                  >
                    {option.label}
                    {option.note && <span className="text-sand-400 ml-1">({option.note})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-sand-500 dark:text-sand-400">
              <RatioIcon className="w-3 h-3" />
              Aspect Ratio
            </label>
            <Select
              value={settings.aspectRatio}
              onValueChange={(value: "auto" | "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "3:2" | "2:3" | "21:9") =>
                setSettings({ ...settings, aspectRatio: value })
              }
            >
              <SelectTrigger className="w-full h-9 bg-sand-50 dark:bg-sand-500/10 border-sand-200 dark:border-sand-500/30 rounded-lg text-sm text-charcoal dark:text-sand-100 focus:ring-terracotta/30 focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1f1e1d] border-sand-200 dark:border-sand-500/30">
                {ASPECT_RATIO_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-sm text-charcoal dark:text-sand-100 focus:bg-sand-100 dark:focus:bg-sand-500/20"
                  >
                    <span className="flex items-center gap-2">
                      <AspectRatioIcon w={option.w} h={option.h} />
                      <span>{option.value === "auto" ? "Auto" : option.value}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ) : (
    // Placeholder button before mount to prevent layout shift
    <button
      className={`${compact ? "p-2" : "p-2.5"} rounded-lg text-sand-400`}
      title="Generation settings"
    >
      <SlidersHorizontal className="w-4 h-4" />
    </button>
  )

  // Generate button (shared)
  const generateButton = (
    <button
      onClick={onGenerate}
      disabled={!canGenerate || isLoading}
      className={`
        group ${compact ? "h-9 px-4" : isMultiline ? "h-9 px-4" : "h-10 px-5"} rounded-lg
        flex items-center justify-center gap-2 flex-shrink-0
        text-xs font-medium tracking-wide uppercase
        transition-all duration-200
        ${
          canGenerate && !isLoading
            ? "bg-charcoal dark:bg-sand-100 text-white dark:text-charcoal hover:bg-charcoal/85 dark:hover:bg-sand-200 active:scale-95"
            : "bg-sand-100 dark:bg-sand-500/10 text-sand-400 dark:text-sand-500 cursor-not-allowed"
        }
      `}
    >
      {isAnalyzing ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {!compact && !isMultiline && <span>Thinking</span>}
        </>
      ) : isGenerating ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {!compact && !isMultiline && <span>Generating</span>}
        </>
      ) : (
        <>
          {!compact && !isMultiline && <span>Generate</span>}
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  )

  return (
    <div className={`flex-shrink-0 ${compact ? "p-2" : ""}`}>
      {/* Main prompt bar */}
      <div
        className={`
          relative
          ${compact ? "p-2" : isMultiline ? "p-3" : "p-2"}
          bg-white dark:bg-[#1f1e1d]
          ${compact ? "rounded-lg" : "rounded-xl"}
          border border-sand-200 dark:border-sand-500/20
          shadow-sm
          transition-all duration-200
        `}
      >
        {/* Multiline layout - textarea on top, buttons bottom-right */}
        {isMultiline && !compact ? (
          <div className="flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full px-2 py-1 bg-transparent text-charcoal dark:text-sand-100 placeholder:text-sand-400 dark:placeholder:text-sand-500 focus:outline-none text-sm resize-none overflow-y-auto"
              style={{ minHeight: "40px" }}
            />

            {/* Bottom bar with settings indicator and buttons */}
            <div className="flex items-center justify-between pt-1 border-t border-sand-100 dark:border-sand-500/10">
              <p className="text-[10px] text-sand-400 dark:text-sand-500">
                {currentStyle} · {currentLighting} · {currentResolution} · {currentAspectRatio}
              </p>
              <div className="flex items-center gap-1.5">
                {settingsPopover}
                {generateButton}
              </div>
            </div>
          </div>
        ) : (
          /* Standard inline layout */
          <div className={`flex ${compact ? "flex-col" : "items-center"} gap-2`}>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={compact ? 2 : 1}
              className={`flex-1 ${compact ? "px-2 py-1.5" : "px-3 py-2.5"} bg-transparent text-charcoal dark:text-sand-100 placeholder:text-sand-400 dark:placeholder:text-sand-500 focus:outline-none text-sm resize-none overflow-hidden`}
              style={compact ? {} : { height: "auto", minHeight: "24px" }}
            />

            {/* Buttons row */}
            <div className={`flex items-center ${compact ? "justify-end" : ""} gap-2`}>
              {settingsPopover}
              {!compact && <div className="w-px h-6 bg-sand-200 dark:bg-sand-500/20" />}
              {generateButton}
            </div>
          </div>
        )}
      </div>

      {/* Current settings indicator - only shown in single-line mode */}
      {!compact && !isMultiline && (
        <div className="flex items-center justify-between px-3 pt-2">
          <p className="text-[10px] text-sand-400 dark:text-sand-500">
            {currentStyle} · {currentLighting} · {currentResolution} · {currentAspectRatio}
          </p>
          {helperText && (
            <p className="text-[10px] text-sand-400 dark:text-sand-500">
              {helperText}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
