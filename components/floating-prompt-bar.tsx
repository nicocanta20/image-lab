"use client"

import { useState, useEffect, useRef } from "react"
import { Wand2, Lightbulb, ImageIcon, MapPin, X, FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PlacedItem } from "./room-designer"

export type GenerationSettings = {
  style: string
  lighting: string
  model: string // Added model to settings
}

type FloatingPromptBarProps = {
  prompt: string
  onPromptChange: (value: string) => void
  onGenerate: (settings: GenerationSettings) => void
  isGenerating: boolean
  selectedCount: number
  hasBase: boolean
  referenceImages: (PlacedItem & { referenceNumber: number })[]
  baseAspectRatio: number
  markerPlacementMode: { refNumber: number } | null
  onStartMarkerPlacement: (mode: { refNumber: number }) => void
  onCancelMarkerPlacement: () => void
}

const styles = [
  { value: "photorealistic", label: "Photorealistic" },
  { value: "modern", label: "Modern" },
  { value: "minimalist", label: "Minimalist" },
  { value: "cozy", label: "Cozy" },
  { value: "industrial", label: "Industrial" },
]

const lightingOptions = [
  { value: "original", label: "Original" },
  { value: "natural-daylight", label: "Natural Daylight" },
  { value: "warm", label: "Warm Ambient" },
  { value: "cool", label: "Cool Modern" },
  { value: "dramatic", label: "Dramatic Shadows" },
  { value: "soft", label: "Soft Diffused" },
]

const modelOptions = [
  { value: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro", speed: "slow" },
  { value: "google/gemini-2.5-flash-image-preview", label: "Gemini 2.5 Flash", speed: "fast" },
  { value: "bfl/flux-kontext-pro", label: "FLUX Kontext Pro", speed: "medium" },
  { value: "bfl/flux-2-pro", label: "FLUX 2 Pro", speed: "medium" },
  { value: "google/imagen-4.0-generate-001", label: "Imagen 4.0", speed: "fast" },
]

export function FloatingPromptBar({
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  selectedCount,
  hasBase,
  referenceImages,
  markerPlacementMode,
  onStartMarkerPlacement,
  onCancelMarkerPlacement,
}: FloatingPromptBarProps) {
  const [selectedStyle, setSelectedStyle] = useState("photorealistic")
  const [selectedLighting, setSelectedLighting] = useState("original")
  const [selectedModel, setSelectedModel] = useState("google/gemini-3-pro-image-preview") // Added model state
  const [showStyleMenu, setShowStyleMenu] = useState(false)
  const [showLightingMenu, setShowLightingMenu] = useState(false)
  const [showModelMenu, setShowModelMenu] = useState(false) // Added model menu state
  const [showDevMode, setShowDevMode] = useState(true) // Dev mode toggle (true for now)

  const styleMenuRef = useRef<HTMLDivElement>(null)
  const lightingMenuRef = useRef<HTMLDivElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null) // Added model menu ref
  const promptBarRef = useRef<HTMLDivElement>(null)

  const hasReferences = referenceImages.length > 0
  const canGenerate = selectedCount >= 1 && (hasReferences || prompt.trim().length > 0)

  const handleGenerate = () => {
    if (!canGenerate || isGenerating) return
    onGenerate({
      style: selectedStyle,
      lighting: selectedLighting,
      model: selectedModel, // Pass model to generate
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        handleGenerate()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [canGenerate, isGenerating, selectedStyle, selectedLighting, selectedModel])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node

      if (showStyleMenu && styleMenuRef.current && !styleMenuRef.current.contains(target)) {
        setShowStyleMenu(false)
      }
      if (showLightingMenu && lightingMenuRef.current && !lightingMenuRef.current.contains(target)) {
        setShowLightingMenu(false)
      }
      if (showModelMenu && modelMenuRef.current && !modelMenuRef.current.contains(target)) {
        setShowModelMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showStyleMenu, showLightingMenu, showModelMenu])

  const getHelperText = () => {
    if (selectedCount === 0) {
      return "Select images and set one as Base"
    }
    if (!hasBase && selectedCount > 0) {
      return "Set one image as Base (the room/background)"
    }
    if (hasBase && !hasReferences && !prompt.trim()) {
      return "Add reference images or write a prompt"
    }
    if (hasBase && hasReferences) {
      return "Place markers on the base image to position objects"
    }
    return "Ready to generate"
  }

  const getLightingLabel = () => {
    const option = lightingOptions.find((l) => l.value === selectedLighting)
    return option?.label || "Original"
  }

  const getModelLabel = () => {
    const option = modelOptions.find((m) => m.value === selectedModel)
    return option?.label || "Gemini 3 Pro"
  }

  const getModelSpeed = () => {
    const option = modelOptions.find((m) => m.value === selectedModel)
    return option?.speed || "medium"
  }

  return (
    <div ref={promptBarRef} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4">
      <div className="rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-2xl">
        {/* Status bar */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 flex-wrap">
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
              selectedCount > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{selectedCount} selected</span>
          </div>

          {hasBase && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-foreground/10 text-foreground text-xs font-medium">
              Base set
            </div>
          )}

          {hasReferences && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {referenceImages.length} reference{referenceImages.length > 1 ? "s" : ""}
            </div>
          )}

          <span className="text-xs text-muted-foreground">{getHelperText()}</span>
        </div>

        {hasBase && hasReferences && (
          <div className="px-4 pb-2">
            <div className="text-xs text-muted-foreground mb-2">Place markers for each reference:</div>
            <div className="flex flex-wrap gap-3">
              {referenceImages.map((ref) => {
                const isActive = markerPlacementMode?.refNumber === ref.referenceNumber

                return (
                  <div key={ref.id} className="flex items-center gap-2">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border-2 border-foreground">
                      <img src={ref.src || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
                      <div className="absolute top-0 left-0 w-4 h-4 rounded-br-lg bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                        {ref.referenceNumber}
                      </div>
                    </div>

                    {isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 bg-transparent"
                        onClick={onCancelMarkerPlacement}
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 bg-transparent"
                        onClick={() => onStartMarkerPlacement({ refNumber: ref.referenceNumber })}
                        title="Click to place a pin, or drag to draw an area"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Place
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Prompt textarea */}
        <div className="px-4 pb-3">
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={
              hasBase && hasReferences
                ? "Optional: Add extra guidance for the generation..."
                : selectedCount === 1
                  ? "Describe what you want to do with this image..."
                  : "Select a base image and add references, or describe your edit..."
            }
            className="w-full min-h-[60px] bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-sm leading-relaxed"
          />
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20 rounded-b-2xl">
          <div className="flex items-center gap-1">
            {/* Style */}
            <div className="relative" ref={styleMenuRef}>
              <button
                onClick={() => {
                  setShowLightingMenu(false)
                  setShowModelMenu(false)
                  setShowStyleMenu(!showStyleMenu)
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                  showStyleMenu
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span className="capitalize">{selectedStyle}</span>
              </button>

              {showStyleMenu && (
                <div className="absolute bottom-full left-0 mb-2 p-1.5 rounded-xl bg-popover border border-border shadow-xl min-w-[160px]">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground mb-1">Style</div>
                  {styles.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => {
                        setSelectedStyle(style.value)
                        setShowStyleMenu(false)
                      }}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-colors",
                        selectedStyle === style.value
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <span>{style.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lighting */}
            <div className="relative" ref={lightingMenuRef}>
              <button
                onClick={() => {
                  setShowStyleMenu(false)
                  setShowModelMenu(false)
                  setShowLightingMenu(!showLightingMenu)
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                  showLightingMenu
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>{getLightingLabel()}</span>
              </button>

              {showLightingMenu && (
                <div className="absolute bottom-full left-0 mb-2 p-1.5 rounded-xl bg-popover border border-border shadow-xl min-w-[160px]">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground mb-1">Lighting</div>
                  {lightingOptions.map((lighting) => (
                    <button
                      key={lighting.value}
                      onClick={() => {
                        setSelectedLighting(lighting.value)
                        setShowLightingMenu(false)
                      }}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-colors",
                        selectedLighting === lighting.value
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <span>{lighting.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {showDevMode && (
              <div className="relative" ref={modelMenuRef}>
                <button
                  onClick={() => {
                    setShowStyleMenu(false)
                    setShowLightingMenu(false)
                    setShowModelMenu(!showModelMenu)
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors border border-dashed border-orange-500/50",
                    showModelMenu
                      ? "bg-orange-500/10 text-orange-500"
                      : "text-orange-500/70 hover:bg-orange-500/10 hover:text-orange-500",
                  )}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>{getModelLabel()}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1 rounded",
                      getModelSpeed() === "fast"
                        ? "bg-green-500/20 text-green-500"
                        : getModelSpeed() === "slow"
                          ? "bg-red-500/20 text-red-500"
                          : "bg-yellow-500/20 text-yellow-500",
                    )}
                  >
                    {getModelSpeed()}
                  </span>
                </button>

                {showModelMenu && (
                  <div className="absolute bottom-full left-0 mb-2 p-1.5 rounded-xl bg-popover border border-border shadow-xl min-w-[220px]">
                    <div className="px-2 py-1 text-xs font-medium text-orange-500 mb-1 flex items-center gap-1">
                      <FlaskConical className="w-3 h-3" />
                      Dev: AI Model
                    </div>
                    {modelOptions.map((model) => (
                      <button
                        key={model.value}
                        onClick={() => {
                          setSelectedModel(model.value)
                          setShowModelMenu(false)
                        }}
                        className={cn(
                          "flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs transition-colors",
                          selectedModel === model.value ? "bg-orange-500 text-white" : "text-foreground hover:bg-muted",
                        )}
                      >
                        <span>{model.label}</span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded",
                            selectedModel === model.value
                              ? "bg-white/20"
                              : model.speed === "fast"
                                ? "bg-green-500/20 text-green-500"
                                : model.speed === "slow"
                                  ? "bg-red-500/20 text-red-500"
                                  : "bg-yellow-500/20 text-yellow-500",
                          )}
                        >
                          {model.speed}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleGenerate} disabled={!canGenerate || isGenerating} size="sm" className="px-4">
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
