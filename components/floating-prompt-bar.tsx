"use client"

import { useEffect } from "react"
import { ArrowUp, MapPin, X, Layers } from "lucide-react"
import TextareaAutosize from "react-textarea-autosize"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PlacedItem } from "./room-designer"

export type GenerationSettings = {
  style: string
  lighting: string
  model: string
}

type FloatingPromptBarProps = {
  prompt: string
  onPromptChange: (value: string) => void
  onGenerate: (settings: GenerationSettings) => void
  isGenerating: boolean
  // Image context
  selectedCount: number
  hasBase: boolean
  baseImage?: PlacedItem | null
  referenceImages: (PlacedItem & { referenceNumber: number })[]
  // Marker placement
  markerPlacementMode: { refNumber: number } | null
  onStartMarkerPlacement: (mode: { refNumber: number }) => void
  onCancelMarkerPlacement: () => void
}

export function FloatingPromptBar({
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  selectedCount,
  hasBase,
  baseImage,
  referenceImages,
  markerPlacementMode,
  onStartMarkerPlacement,
  onCancelMarkerPlacement,
}: FloatingPromptBarProps) {
  const hasReferences = referenceImages.length > 0
  const canGenerate = hasBase && (hasReferences || prompt.trim().length > 0)

  const handleGenerate = () => {
    if (!canGenerate || isGenerating) return
    onGenerate({
      style: "photorealistic",
      lighting: "original",
      model: "google/gemini-3-pro-image-preview",
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
  }, [canGenerate, isGenerating])

  const getPlaceholder = () => {
    if (!hasBase) return "Select an image and set it as base to start..."
    if (!hasReferences) return "Add reference images or describe what to change..."
    return "Add instructions for the generation..."
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4">
      <div className="rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-2xl overflow-hidden">

        {/* Context Panel - Shows base and references when available */}
        {(hasBase || hasReferences) && (
          <div className="px-4 pt-3 pb-2 border-b border-border/50">
            <div className="flex items-start gap-4">

              {/* Base Image */}
              {baseImage && (
                <div className="flex items-center gap-2">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden border-2 border-primary">
                    <img src={baseImage.src} alt="Base" className="w-full h-full object-cover" />
                    <div className="absolute top-0 left-0 w-4 h-4 rounded-br-lg bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      <Layers className="w-2.5 h-2.5" />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Base</span>
                </div>
              )}

              {/* References */}
              {hasReferences && (
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-3 items-center">
                    {referenceImages.slice(0, 3).map((ref) => {
                      const isActive = markerPlacementMode?.refNumber === ref.referenceNumber

                      return (
                        <div key={ref.id} className="flex items-center gap-2">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-border">
                            <img src={ref.src} alt="" className="w-full h-full object-cover" />
                            <div className="absolute top-0 left-0 w-4 h-4 rounded-br-lg bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                              {ref.referenceNumber}
                            </div>
                          </div>
                          {isActive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={onCancelMarkerPlacement}
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => onStartMarkerPlacement({ refNumber: ref.referenceNumber })}
                            >
                              <MapPin className="w-3 h-3" />
                              Place
                            </Button>
                          )}
                        </div>
                      )
                    })}
                    {referenceImages.length >= 3 && (
                      <span className="text-[10px] text-muted-foreground">Max 3</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Section */}
        <InputGroup className="border-0 shadow-none rounded-none bg-transparent">
          <TextareaAutosize
            data-slot="input-group-control"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={getPlaceholder()}
            minRows={1}
            maxRows={6}
            className="flex field-sizing-content min-h-12 w-full resize-none bg-transparent px-4 py-3 text-sm transition-[color,box-shadow] outline-none placeholder:text-muted-foreground"
          />
          <InputGroupAddon align="block-end" className="justify-end">
            <InputGroupButton
              size="icon-sm"
              variant="default"
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="rounded-full"
            >
              <ArrowUp className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  )
}
