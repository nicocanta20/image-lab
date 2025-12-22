"use client"

import { useRef, useCallback, useEffect } from "react"
import type { Marker, RoomImage, ReferenceImage } from "./SimpleRoomDesigner"
import { MarkerOverlay } from "./MarkerOverlay"
import { X, MousePointer2, ImagePlus } from "lucide-react"

interface RoomImageViewerProps {
  image: RoomImage
  markers: Marker[]
  references: ReferenceImage[]
  activeReferenceForPlacement: number | null
  onAddPin: (x: number, y: number) => void
  onRemoveMarker: (id: string) => void
  onCancelPlacement: () => void
  onChangeImage: () => void
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
}: RoomImageViewerProps) {
  const imageRef = useRef<HTMLImageElement>(null)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeReferenceForPlacement === null) return
      if (!imageRef.current) return

      const rect = imageRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      // Only accept clicks within the image bounds
      if (x < 0 || x > 100 || y < 0 || y > 100) return

      onAddPin(x, y)
    },
    [activeReferenceForPlacement, onAddPin]
  )

  // Handle escape key to cancel placement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeReferenceForPlacement !== null) {
        onCancelPlacement()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeReferenceForPlacement, onCancelPlacement])

  const isPlacementMode = activeReferenceForPlacement !== null
  const activeReference = references.find(
    (r) => r.referenceNumber === activeReferenceForPlacement
  )

  return (
    <div
      className="h-full w-full rounded-xl md:rounded-2xl overflow-hidden bg-sand-100 dark:bg-[#222120] flex items-center justify-center"
    >
      {/* Image wrapper */}
      <div
        className={`relative ${isPlacementMode ? 'cursor-crosshair' : ''}`}
        style={{
          display: 'inline-flex',
          lineHeight: 0,
          fontSize: 0,
        }}
        onClick={isPlacementMode ? handleClick : undefined}
      >
        <img
          ref={imageRef}
          src={image.src}
          alt={image.name}
          draggable={false}
          className="block select-none rounded-lg md:rounded-xl max-w-full max-h-full md:max-w-[calc(100vw-420px)] md:max-h-[calc(100vh-200px)]"
          style={{
            verticalAlign: 'top',
          }}
        />

        {/* Overlay */}
        <div
          className="absolute overflow-visible pointer-events-none"
          style={{ top: 0, left: 0, width: '100%', height: '100%' }}
        >
          <MarkerOverlay
            markers={markers}
            references={references}
            onRemoveMarker={onRemoveMarker}
          />
        </div>

      </div>

      {/* Change image button - positioned in outer container */}
      <button
        onClick={onChangeImage}
        className="absolute top-2 left-2 md:top-3 md:left-3 p-2 rounded-lg bg-charcoal/70 hover:bg-charcoal/90 active:bg-charcoal text-white backdrop-blur-sm transition-all opacity-70 hover:opacity-100"
        title="Change image"
      >
        <ImagePlus className="w-4 h-4" />
      </button>

      {/* Placement mode indicator */}
      {isPlacementMode && activeReference && (
        <div className="absolute top-2 md:top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 bg-charcoal/95 dark:bg-sand-100/95 text-white dark:text-charcoal rounded-full shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
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
    </div>
  )
}
