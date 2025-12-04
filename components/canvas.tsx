"use client"

import type React from "react"

import { forwardRef, useEffect, useRef, useState, useCallback } from "react"
import { Upload, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PlacedFurniture } from "./room-designer"

type CanvasProps = {
  roomImage: string | null
  placedFurniture: PlacedFurniture[]
  selectedFurniture: string | null
  onRoomUpload: (imageUrl: string) => void
  onFurnitureMove: (id: string, x: number, y: number) => void
  onFurnitureSelect: (id: string | null) => void
  onFurnitureDelete: (id: string) => void
}

export const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>(
  (
    {
      roomImage,
      placedFurniture,
      selectedFurniture,
      onRoomUpload,
      onFurnitureMove,
      onFurnitureSelect,
      onFurnitureDelete,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [dragging, setDragging] = useState<string | null>(null)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
    const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map())

    // Combine refs
    useEffect(() => {
      if (typeof ref === "function") {
        ref(canvasRef.current)
      } else if (ref) {
        ref.current = canvasRef.current
      }
    }, [ref])

    // Update canvas size based on container
    useEffect(() => {
      const updateSize = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          setCanvasSize({
            width: rect.width,
            height: rect.height,
          })
        }
      }

      updateSize()
      window.addEventListener("resize", updateSize)
      return () => window.removeEventListener("resize", updateSize)
    }, [])

    // Load images
    useEffect(() => {
      const imagesToLoad = [roomImage, ...placedFurniture.map((f) => f.item.image)].filter(Boolean) as string[]

      imagesToLoad.forEach((src) => {
        if (!loadedImages.has(src)) {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.onload = () => {
            setLoadedImages((prev) => new Map(prev).set(src, img))
          }
          img.src = src
        }
      })
    }, [roomImage, placedFurniture, loadedImages])

    // Draw canvas
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Clear canvas
      ctx.fillStyle = "var(--background)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw room image
      if (roomImage && loadedImages.has(roomImage)) {
        const img = loadedImages.get(roomImage)!
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
        const x = (canvas.width - img.width * scale) / 2
        const y = (canvas.height - img.height * scale) / 2
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
      }

      // Draw placed furniture
      placedFurniture.forEach((furniture) => {
        if (loadedImages.has(furniture.item.image)) {
          const img = loadedImages.get(furniture.item.image)!
          const size = 100 * furniture.scale
          const x = (furniture.x / 100) * canvas.width - size / 2
          const y = (furniture.y / 100) * canvas.height - size / 2

          ctx.drawImage(img, x, y, size, size)

          // Draw selection border
          if (selectedFurniture === furniture.id) {
            ctx.strokeStyle = "#3b82f6"
            ctx.lineWidth = 2
            ctx.setLineDash([5, 5])
            ctx.strokeRect(x - 4, y - 4, size + 8, size + 8)
            ctx.setLineDash([])
          }
        }
      })
    }, [roomImage, placedFurniture, selectedFurniture, loadedImages, canvasSize])

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          onRoomUpload(event.target?.result as string)
        }
        reader.readAsDataURL(file)
      }
    }

    const getCanvasCoords = useCallback((e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }

      const rect = canvas.getBoundingClientRect()
      return {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      }
    }, [])

    const handleMouseDown = (e: React.MouseEvent) => {
      const coords = getCanvasCoords(e)

      // Check if clicking on furniture
      for (let i = placedFurniture.length - 1; i >= 0; i--) {
        const f = placedFurniture[i]
        const size = ((100 * f.scale) / canvasSize.width) * 100
        if (
          coords.x >= f.x - size / 2 &&
          coords.x <= f.x + size / 2 &&
          coords.y >= f.y - size / 2 &&
          coords.y <= f.y + size / 2
        ) {
          onFurnitureSelect(f.id)
          setDragging(f.id)
          setDragOffset({
            x: coords.x - f.x,
            y: coords.y - f.y,
          })
          return
        }
      }

      onFurnitureSelect(null)
    }

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragging) return

      const coords = getCanvasCoords(e)
      onFurnitureMove(
        dragging,
        Math.max(0, Math.min(100, coords.x - dragOffset.x)),
        Math.max(0, Math.min(100, coords.y - dragOffset.y)),
      )
    }

    const handleMouseUp = () => {
      setDragging(null)
    }

    return (
      <div
        ref={containerRef}
        className="relative w-full h-full rounded-2xl border border-border bg-muted/30 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {!roomImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-foreground">Upload a room photo</h3>
              <p className="text-sm text-muted-foreground mt-1">Drag and drop or click to upload</p>
            </div>
            <label>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" className="cursor-pointer bg-transparent" asChild>
                <span>Choose File</span>
              </Button>
            </label>
          </div>
        )}

        {/* Selected furniture controls */}
        {selectedFurniture && (
          <div className="absolute top-4 right-4 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => onFurnitureDelete(selectedFurniture)}>
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        )}

        {/* Upload new room button */}
        {roomImage && (
          <label className="absolute top-4 left-4">
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            <Button size="sm" variant="secondary" className="cursor-pointer" asChild>
              <span>
                <Upload className="w-4 h-4 mr-1" />
                Change Room
              </span>
            </Button>
          </label>
        )}
      </div>
    )
  },
)

Canvas.displayName = "Canvas"
