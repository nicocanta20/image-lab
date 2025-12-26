"use client"

import { useRef, useCallback, useEffect, useState } from "react"
import type { Marker, RoomImage, ReferenceImage } from "./SimpleRoomDesigner"
import { MarkerOverlay } from "./MarkerOverlay"
import { LassoSelection } from "./LassoSelection"
import { X, MousePointer2, ImagePlus, Lasso, History } from "lucide-react"

interface RoomImageViewerProps {
  image: RoomImage
  originalImage?: RoomImage | null  // For before/after comparison
  onClearOriginal?: () => void
  markers: Marker[]
  references: ReferenceImage[]
  activeReferenceForPlacement: number | null
  onAddPin: (x: number, y: number) => void
  onRemoveMarker: (id: string) => void
  onCancelPlacement: () => void
  onChangeImage: () => void
  // Selection/inpainting props
  isSelectionMode?: boolean
  hasSelection?: boolean
  onSelectionModeToggle?: () => void
  onSelectionChange?: (hasSelection: boolean, overlayDataUrl: string | null) => void
  onClearSelection?: () => void
}

export function RoomImageViewer({
  image,
  markers,
  references,
  activeReferenceForPlacement,
  onAddPin,
  onRemoveMarker,
  onCancelPlacement,
  onChangeImage,
  isSelectionMode = false,
  hasSelection = false,
  onSelectionModeToggle,
  onSelectionChange,
  onClearSelection,
}: RoomImageViewerProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })

  // Track image dimensions for lasso canvas
  useEffect(() => {
    const updateDimensions = () => {
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect()
        setImageDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)

    const img = imageRef.current
    if (img) {
      img.addEventListener("load", updateDimensions)
    }

    return () => {
      window.removeEventListener("resize", updateDimensions)
      if (img) {
        img.removeEventListener("load", updateDimensions)
      }
    }
  }, [image.src])

  // Handle selection complete - only overlay, no black/white mask
  const handleSelectionComplete = useCallback((overlayDataUrl: string) => {
    onSelectionChange?.(true, overlayDataUrl)
  }, [onSelectionChange])

  // Handle selection clear
  const handleSelectionClear = useCallback(() => {
    onSelectionChange?.(false, null)
    onClearSelection?.()
  }, [onSelectionChange, onClearSelection])

  // Marker placement click handler
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isSelectionMode) return
      if (activeReferenceForPlacement === null) return
      if (!imageRef.current) return

      const rect = imageRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      if (x < 0 || x > 100 || y < 0 || y > 100) return

      onAddPin(x, y)
    },
    [isSelectionMode, activeReferenceForPlacement, onAddPin]
  )

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isSelectionMode && onSelectionModeToggle) {
          onSelectionModeToggle()
        } else if (activeReferenceForPlacement !== null) {
          onCancelPlacement()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isSelectionMode, activeReferenceForPlacement, onCancelPlacement, onSelectionModeToggle])

  const isPlacementMode = activeReferenceForPlacement !== null
  const activeReference = references.find(
    (r) => r.referenceNumber === activeReferenceForPlacement
  )

  const getCursorClass = () => {
    if (isSelectionMode) return "cursor-crosshair"
    if (isPlacementMode) return "cursor-crosshair"
    return ""
  }

  return (
    <div className="h-full w-full rounded-xl md:rounded-2xl overflow-hidden bg-sand-100 dark:bg-[#222120] flex items-center justify-center relative">
      {/* Image wrapper */}
      <div
        ref={containerRef}
        className={`relative ${getCursorClass()}`}
        style={{ display: "inline-flex", lineHeight: 0, fontSize: 0 }}
        onClick={!isSelectionMode ? handleClick : undefined}
      >
        <img
          ref={imageRef}
          src={image.src}
          alt={image.name}
          draggable={false}
          className="block select-none rounded-lg md:rounded-xl max-w-full max-h-full md:max-w-[calc(100vw-420px)] md:max-h-[calc(100vh-200px)]"
          style={{ verticalAlign: "top" }}
        />

        {/* Lasso Selection overlay */}
        <LassoSelection
          width={imageDimensions.width}
          height={imageDimensions.height}
          isActive={isSelectionMode}
          onSelectionComplete={handleSelectionComplete}
          onSelectionClear={handleSelectionClear}
        />

        {/* Marker overlay */}
        {!isSelectionMode && (
          <div
            className="absolute overflow-visible pointer-events-none"
            style={{ top: 0, left: 0, width: "100%", height: "100%" }}
          >
            <MarkerOverlay
              markers={markers}
              references={references}
              onRemoveMarker={onRemoveMarker}
            />
          </div>
        )}
      </div>

      {/* Toolbar - top left */}
      <div className="absolute top-2 left-2 md:top-3 md:left-3 flex items-center gap-1.5">
        <button
          onClick={onChangeImage}
          className="p-2 rounded-lg bg-charcoal/70 hover:bg-charcoal/90 active:bg-charcoal text-white backdrop-blur-sm transition-all opacity-80 hover:opacity-100"
          title="Change image"
        >
          <ImagePlus className="w-4 h-4" />
        </button>

        {onSelectionModeToggle && (
          <button
            onClick={onSelectionModeToggle}
            className={`
              p-2 rounded-lg backdrop-blur-sm transition-all
              ${isSelectionMode
                ? "bg-terracotta text-white"
                : "bg-charcoal/70 hover:bg-charcoal/90 active:bg-charcoal text-white opacity-80 hover:opacity-100"
              }
            `}
            title={isSelectionMode ? "Exit selection mode" : "Select area to edit"}
          >
            <Lasso className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Selection mode indicator */}
      {isSelectionMode && (
        <div className="absolute top-2 md:top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-terracotta text-white text-xs font-medium rounded-full shadow-lg">
            <Lasso className="w-3 h-3" />
            <span>Lasso select</span>
          </div>
          <button
            onClick={onSelectionModeToggle}
            className="px-3 py-1.5 bg-charcoal/90 hover:bg-charcoal text-white text-xs font-medium rounded-full shadow-lg backdrop-blur-sm transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* Placement mode indicator */}
      {isPlacementMode && activeReference && !isSelectionMode && (
        <div className="absolute top-2 md:top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 bg-charcoal/95 dark:bg-sand-100/95 text-white dark:text-charcoal rounded-full shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-white font-semibold text-[10px]"
            style={{ backgroundColor: "#c4653a" }}
          >
            {activeReference.referenceNumber}
          </div>
          <div className="flex items-center gap-1">
            <MousePointer2 className="w-3 h-3" />
            <span className="text-[11px] md:text-xs font-medium">
              <span className="hidden sm:inline">Click to place</span>
              <span className="sm:hidden">Tap to place</span>
            </span>
          </div>
          <button
            onClick={onCancelPlacement}
            className="ml-0.5 p-1 rounded-full hover:bg-white/20 dark:hover:bg-charcoal/20 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Mobile hint */}
      {isSelectionMode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 md:hidden">
          <p className="text-[10px] text-white/70 bg-charcoal/60 px-2 py-1 rounded-full backdrop-blur-sm">
            Circle the area to edit
          </p>
        </div>
      )}
    </div>
  )
}
