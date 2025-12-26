"use client"

import type React from "react"
import { forwardRef, useState, useCallback, useRef, useEffect } from "react"
import { Rnd } from "react-rnd"
import { Upload, Download, X, Check, Crown, Undo2, Redo2, Minus, Plus, ArrowUpFromLine, Loader2, ImageIcon, Eraser } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PlacedItem, Marker } from "./room-designer"
import { cn } from "@/lib/utils"

type Tool = "select" | "catalog" | "hand"

type InfiniteCanvasProps = {
  items: PlacedItem[]
  selectedItem: string | null
  selectedForGeneration: Set<string>
  baseImageId: string | null
  markerPlacementMode: { refNumber: number } | null
  activeTool: Tool
  upscalingItems: Set<string>
  removingBgItems: Set<string>
  onItemSelect: (id: string | null) => void
  onToggleGenerationSelection: (id: string) => void
  onSetBase: (id: string) => void
  onItemUpdate: (id: string, updates: Partial<PlacedItem>) => void
  onItemDelete: (id: string) => void
  onItemsDelete: (ids: string[]) => void
  onRoomUpload: (imageUrl: string, filename?: string) => void
  onDownloadItem: (item: PlacedItem) => void
  onUpscaleItem: (item: PlacedItem, scale: number) => void
  onRemoveBgItem: (item: PlacedItem) => void
  onAddPin: (x: number, y: number) => void
  onAddLasso: (points: { x: number; y: number }[]) => void
  onRemoveMarker: (markerId: string) => void
  getReferenceImages: () => (PlacedItem & { referenceNumber: number })[]
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const LASSO_MIN_DISTANCE = 3
const DRAG_THRESHOLD = 8

export const InfiniteCanvas = forwardRef<HTMLDivElement, InfiniteCanvasProps>(
  (
    {
      items,
      selectedItem,
      selectedForGeneration,
      baseImageId,
      markerPlacementMode,
      activeTool,
      upscalingItems,
      removingBgItems,
      onItemSelect,
      onToggleGenerationSelection,
      onSetBase,
      onItemUpdate,
      onItemDelete,
      onItemsDelete,
      onRoomUpload,
      onDownloadItem,
      onUpscaleItem,
      onRemoveBgItem,
      onAddPin,
      onAddLasso,
      onRemoveMarker,
      getReferenceImages,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [hoveredItem, setHoveredItem] = useState<string | null>(null)
    const [isDraggingOver, setIsDraggingOver] = useState(false)

    const [isMouseDown, setIsMouseDown] = useState(false)
    const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(
      null,
    )
    const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const baseImageRef = useRef<HTMLDivElement | null>(null)

    const [isRectSelecting, setIsRectSelecting] = useState(false)
    const [rectSelectStart, setRectSelectStart] = useState<{ x: number; y: number } | null>(null)
    const [rectSelectEnd, setRectSelectEnd] = useState<{ x: number; y: number } | null>(null)
    const [multiSelectedItems, setMultiSelectedItems] = useState<Set<string>>(new Set())

    // Hand tool panning state
    const [isPanning, setIsPanning] = useState(false)
    const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null)

    const referenceImages = getReferenceImages()

    const sortedItems = [...items].sort((a, b) => {
      const areaA = a.width * a.height
      const areaB = b.width * b.height
      return areaB - areaA // Larger items first (lower z-index)
    })

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault()

        if (e.ctrlKey || e.metaKey) {
          const rect = container.getBoundingClientRect()
          const mouseX = e.clientX - rect.left
          const mouseY = e.clientY - rect.top

          const delta = -e.deltaY * 0.01
          const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta))
          const zoomRatio = newZoom / zoom

          // Adjust pan to keep mouse position stable
          setPanOffset((prev) => ({
            x: mouseX - (mouseX - prev.x) * zoomRatio,
            y: mouseY - (mouseY - prev.y) * zoomRatio,
          }))
          setZoom(newZoom)
        } else {
          setPanOffset((prev) => ({
            x: prev.x - e.deltaX,
            y: prev.y - e.deltaY,
          }))
        }
      }

      container.addEventListener("wheel", handleWheel, { passive: false })
      return () => container.removeEventListener("wheel", handleWheel)
    }, [zoom])

    useEffect(() => {
      if (!isMouseDown || !markerPlacementMode) return

      const handleMouseMove = (e: MouseEvent) => {
        if (!baseImageRef.current || !mouseDownPos) return

        // Check if we've moved enough to be considered dragging
        const distMoved = Math.sqrt(
          Math.pow(e.clientX - mouseDownPos.clientX, 2) + Math.pow(e.clientY - mouseDownPos.clientY, 2),
        )

        if (distMoved > DRAG_THRESHOLD) {
          setIsDragging(true)
        }

        if (isDragging || distMoved > DRAG_THRESHOLD) {
          const rect = baseImageRef.current.getBoundingClientRect()
          const x = ((e.clientX - rect.left) / rect.width) * 100
          const y = ((e.clientY - rect.top) / rect.height) * 100

          const clampedX = Math.max(0, Math.min(100, x))
          const clampedY = Math.max(0, Math.min(100, y))

          setLassoPoints((prev) => {
            if (prev.length === 0) return [{ x: clampedX, y: clampedY }]

            const lastPoint = prev[prev.length - 1]
            const distance = Math.sqrt(Math.pow(clampedX - lastPoint.x, 2) + Math.pow(clampedY - lastPoint.y, 2))

            if (distance >= LASSO_MIN_DISTANCE) {
              return [...prev, { x: clampedX, y: clampedY }]
            }
            return prev
          })
        }
      }

      const handleMouseUp = () => {
        if (isDragging && lassoPoints.length > 2) {
          // It was a drag - create lasso
          const simplifiedPoints = simplifyPath(lassoPoints, 1.5)
          onAddLasso(simplifiedPoints)
        } else if (mouseDownPos && !isDragging) {
          // It was a click - create pin
          onAddPin(mouseDownPos.x, mouseDownPos.y)
        }

        setIsMouseDown(false)
        setMouseDownPos(null)
        setLassoPoints([])
        setIsDragging(false)
      }

      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)

      return () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
    }, [isMouseDown, isDragging, lassoPoints, mouseDownPos, markerPlacementMode, onAddLasso, onAddPin])

    useEffect(() => {
      if (!isRectSelecting) return

      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        setRectSelectEnd({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      }

      const handleMouseUp = () => {
        if (rectSelectStart && rectSelectEnd) {
          // Calculate which items are inside the selection rectangle
          const selectionRect = {
            left: Math.min(rectSelectStart.x, rectSelectEnd.x),
            right: Math.max(rectSelectStart.x, rectSelectEnd.x),
            top: Math.min(rectSelectStart.y, rectSelectEnd.y),
            bottom: Math.max(rectSelectStart.y, rectSelectEnd.y),
          }

          const selectedIds = new Set<string>()
          items.forEach((item) => {
            // Transform item coordinates to screen coordinates
            const itemLeft = item.x * zoom + panOffset.x
            const itemTop = item.y * zoom + panOffset.y
            const itemRight = itemLeft + item.width * zoom
            const itemBottom = itemTop + item.height * zoom

            // Check intersection
            if (
              itemRight > selectionRect.left &&
              itemLeft < selectionRect.right &&
              itemBottom > selectionRect.top &&
              itemTop < selectionRect.bottom
            ) {
              selectedIds.add(item.id)
            }
          })

          setMultiSelectedItems(selectedIds)
        }

        setIsRectSelecting(false)
        setRectSelectStart(null)
        setRectSelectEnd(null)
      }

      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)

      return () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
    }, [isRectSelecting, rectSelectStart, rectSelectEnd, items, zoom, panOffset])

    // Hand tool panning effect
    useEffect(() => {
      if (!isPanning || !panStart) return

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - panStart.x
        const deltaY = e.clientY - panStart.y
        setPanOffset((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }))
        setPanStart({ x: e.clientX, y: e.clientY })
      }

      const handleMouseUp = () => {
        setIsPanning(false)
        setPanStart(null)
      }

      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)

      return () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
    }, [isPanning, panStart])

    const simplifyPath = (points: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] => {
      if (points.length <= 2) return points

      const first = points[0]
      const last = points[points.length - 1]
      let maxDist = 0
      let maxIndex = 0

      for (let i = 1; i < points.length - 1; i++) {
        const dist = perpendicularDistance(points[i], first, last)
        if (dist > maxDist) {
          maxDist = dist
          maxIndex = i
        }
      }

      if (maxDist > tolerance) {
        const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance)
        const right = simplifyPath(points.slice(maxIndex), tolerance)
        return [...left.slice(0, -1), ...right]
      }

      return [first, last]
    }

    const perpendicularDistance = (
      point: { x: number; y: number },
      lineStart: { x: number; y: number },
      lineEnd: { x: number; y: number },
    ): number => {
      const dx = lineEnd.x - lineStart.x
      const dy = lineEnd.y - lineStart.y

      if (dx === 0 && dy === 0) {
        return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2))
      }

      const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy)
      const closestX = lineStart.x + t * dx
      const closestY = lineStart.y + t * dy

      return Math.sqrt(Math.pow(point.x - closestX, 2) + Math.pow(point.y - closestY, 2))
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        const filename = file.name
        const reader = new FileReader()
        reader.onload = (event) => {
          onRoomUpload(event.target?.result as string, filename)
        }
        reader.readAsDataURL(file)
      }
    }

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingOver(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingOver(false)
    }, [])

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingOver(false)

        const files = e.dataTransfer.files
        if (files.length > 0) {
          const file = files[0]
          if (file.type.startsWith("image/")) {
            const filename = file.name
            const reader = new FileReader()
            reader.onload = (event) => {
              onRoomUpload(event.target?.result as string, filename)
            }
            reader.readAsDataURL(file)
          }
        }
      },
      [onRoomUpload],
    )

    const handleCanvasMouseDown = useCallback(
      (e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        if (target === containerRef.current || target.dataset.canvas === "true") {
          if (markerPlacementMode) return

          // Hand tool: start panning
          if (activeTool === "hand") {
            setIsPanning(true)
            setPanStart({ x: e.clientX, y: e.clientY })
            return
          }

          // Select tool: start rectangle selection
          if (activeTool === "select") {
            const rect = containerRef.current!.getBoundingClientRect()
            setRectSelectStart({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            })
            setRectSelectEnd({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            })
            setIsRectSelecting(true)
            setMultiSelectedItems(new Set())
          }
        }
      },
      [markerPlacementMode, activeTool],
    )

    const handleCanvasClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.target === containerRef.current || (e.target as HTMLElement).dataset.canvas === "true") {
          onItemSelect(null)
          setMultiSelectedItems(new Set())
        }
      },
      [onItemSelect],
    )

    const handleImageMouseDown = useCallback(
      (e: React.MouseEvent, item: PlacedItem, imageElement: HTMLDivElement) => {
        if (!markerPlacementMode || item.id !== baseImageId) return

        e.stopPropagation()
        e.preventDefault()

        const rect = imageElement.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100

        baseImageRef.current = imageElement
        setIsMouseDown(true)
        setMouseDownPos({ x, y, clientX: e.clientX, clientY: e.clientY })
        setLassoPoints([{ x, y }])
        setIsDragging(false)
      },
      [markerPlacementMode, baseImageId],
    )

    const handleZoomIn = () => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      const newZoom = Math.min(MAX_ZOOM, zoom + 0.25)
      const zoomRatio = newZoom / zoom

      setPanOffset((prev) => ({
        x: centerX - (centerX - prev.x) * zoomRatio,
        y: centerY - (centerY - prev.y) * zoomRatio,
      }))
      setZoom(newZoom)
    }

    const handleZoomOut = () => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      const newZoom = Math.max(MIN_ZOOM, zoom - 0.25)
      const zoomRatio = newZoom / zoom

      setPanOffset((prev) => ({
        x: centerX - (centerX - prev.x) * zoomRatio,
        y: centerY - (centerY - prev.y) * zoomRatio,
      }))
      setZoom(newZoom)
    }

    const handleResetView = () => {
      setZoom(1)
      setPanOffset({ x: 0, y: 0 })
    }

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Delete" || e.key === "Backspace") {
          const activeElement = document.activeElement
          if (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA") {
            return
          }
          e.preventDefault()

          if (multiSelectedItems.size > 0) {
            // Delete all multi-selected items
            onItemsDelete(Array.from(multiSelectedItems))
            setMultiSelectedItems(new Set())
          } else if (selectedItem) {
            // Delete single selected item
            onItemDelete(selectedItem)
          }
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [selectedItem, multiSelectedItems, onItemDelete, onItemsDelete])

    const hasItems = items.length > 0

    const getRefNumber = (itemId: string) => {
      const ref = referenceImages.find((r) => r.id === itemId)
      return ref?.referenceNumber
    }

    const renderMarker = (marker: Marker) => {
      // Get object name for this reference
      const refItem = referenceImages.find((r) => r.referenceNumber === marker.referenceNumber)
      const objectName = refItem?.item?.name || refItem?.type || "Object"

      if (marker.type === "pin") {
        return (
          <div
            key={marker.id}
            className="absolute cursor-pointer hover:scale-105 transition-transform"
            style={{
              left: `${marker.x}%`,
              top: `${marker.y}%`,
            }}
            onClick={(e) => {
              e.stopPropagation()
              onRemoveMarker(marker.id)
            }}
            title={`${marker.referenceNumber}: ${objectName} - Click to remove`}
          >
            {/* Number circle centered on click point */}
            <div className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md bg-foreground text-background">
              {marker.referenceNumber}
            </div>
            {/* Label positioned to the right of the number */}
            <div className="absolute left-2 -translate-y-1/2 px-2 py-0.5 rounded text-xs font-medium shadow-md bg-foreground/90 text-background whitespace-nowrap">
              {objectName}
            </div>
          </div>
        )
      } else if (marker.type === "lasso" && marker.points.length > 2) {
        const centroidX = marker.points.reduce((sum, p) => sum + p.x, 0) / marker.points.length
        const centroidY = marker.points.reduce((sum, p) => sum + p.y, 0) / marker.points.length

        return (
          <div key={marker.id} className="absolute inset-0 pointer-events-none">
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <polygon
                points={marker.points.map((p) => `${p.x},${p.y}`).join(" ")}
                className="fill-foreground/15 stroke-foreground pointer-events-auto cursor-pointer hover:fill-foreground/25"
                strokeWidth="0.3"
                strokeDasharray="1,1"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveMarker(marker.id)
                }}
              />
            </svg>
            <div
              className="absolute pointer-events-auto cursor-pointer hover:scale-105 transition-transform"
              style={{
                left: `${centroidX}%`,
                top: `${centroidY}%`,
              }}
              onClick={(e) => {
                e.stopPropagation()
                onRemoveMarker(marker.id)
              }}
              title={`${marker.referenceNumber}: ${objectName} - Click to remove`}
            >
              {/* Number circle centered on centroid */}
              <div className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md bg-foreground text-background">
                {marker.referenceNumber}
              </div>
              {/* Label positioned to the right of the number */}
              <div className="absolute left-2 -translate-y-1/2 px-2 py-0.5 rounded text-xs font-medium shadow-md bg-foreground/90 text-background whitespace-nowrap">
                {objectName}
              </div>
            </div>
          </div>
        )
      }
      return null
    }

    const selectionRect =
      rectSelectStart && rectSelectEnd
        ? {
            left: Math.min(rectSelectStart.x, rectSelectEnd.x),
            top: Math.min(rectSelectStart.y, rectSelectEnd.y),
            width: Math.abs(rectSelectEnd.x - rectSelectStart.x),
            height: Math.abs(rectSelectEnd.y - rectSelectStart.y),
          }
        : null

    return (
      <div
        ref={(node) => {
          containerRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        }}
        className={cn(
          "absolute inset-0 overflow-hidden select-none",
          // Cursor based on tool
          activeTool === "hand" && !isPanning && "cursor-grab",
          activeTool === "hand" && isPanning && "cursor-grabbing",
          activeTool === "select" && !isRectSelecting && "cursor-default",
          activeTool === "select" && isRectSelecting && "cursor-crosshair",
          // Override for special modes
          isDraggingOver && "ring-4 ring-inset ring-primary/50",
          markerPlacementMode && "cursor-crosshair",
        )}
        style={{ touchAction: "none" }}
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
        onDragStart={(e) => e.preventDefault()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Canvas Click Layer - receives all clicks on empty areas */}
        <div
          data-canvas="true"
          className="absolute inset-0"
          style={{ zIndex: 0 }}
        />

        {/* Grid Background */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
            `,
            backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
            backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
          }}
        />

        {/* Rectangle Selection Overlay */}
        {isRectSelecting && selectionRect && (
          <div
            className="absolute border border-primary/80 bg-primary/5 pointer-events-none"
            style={{
              left: selectionRect.left,
              top: selectionRect.top,
              width: Math.max(selectionRect.width, 1),
              height: Math.max(selectionRect.height, 1),
              zIndex: 10,
            }}
          />
        )}


        {/* Drag overlay indicator */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="text-lg font-medium text-foreground">Drop image here</p>
            </div>
          </div>
        )}

        {/* Canvas Content - transformed layer */}
        <div
          className="absolute inset-0 origin-top-left pointer-events-none"
          style={{
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoom})`,
            willChange: "transform",
            zIndex: 1,
          }}
        >
          {sortedItems.map((item, index) => {
            const isSelectedForGen = selectedForGeneration.has(item.id)
            const isBase = item.id === baseImageId
            const refNumber = getRefNumber(item.id)
            const isMultiSelected = multiSelectedItems.has(item.id)

            return (
              <Rnd
                key={item.id}
                size={{ width: item.width, height: item.height }}
                position={{ x: item.x, y: item.y }}
                onDragStop={(e, d) => {
                  onItemUpdate(item.id, { x: d.x, y: d.y })
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const newWidth = Number.parseInt(ref.style.width)
                  const newHeight = Number.parseInt(ref.style.height)
                  onItemUpdate(item.id, {
                    width: newWidth,
                    height: newHeight,
                    x: position.x,
                    y: position.y,
                  })
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  onItemSelect(item.id)
                  setMultiSelectedItems(new Set())
                }}
                lockAspectRatio={true}
                minWidth={50}
                minHeight={50}
                style={{
                  zIndex: selectedItem === item.id ? 1000 : index + 1,
                  pointerEvents: "auto",
                }}
                enableResizing={{
                  top: false,
                  right: false,
                  bottom: false,
                  left: false,
                  topRight: true,
                  bottomRight: true,
                  bottomLeft: true,
                  topLeft: true,
                }}
                resizeHandleStyles={{
                  topLeft: { cursor: "nwse-resize" },
                  topRight: { cursor: "nesw-resize" },
                  bottomLeft: { cursor: "nesw-resize" },
                  bottomRight: { cursor: "nwse-resize" },
                }}
                scale={zoom}
                disableDragging={markerPlacementMode !== null && isBase}
              >
                <div
                  className={cn(
                    "relative w-full h-full overflow-hidden transition-all",
                    selectedItem === item.id && "ring-2 ring-primary shadow-xl",
                    isMultiSelected && "ring-2 ring-primary/70 shadow-lg bg-primary/5",
                    !selectedItem && !isMultiSelected && isBase && "ring-2 ring-foreground shadow-lg",
                    !selectedItem && !isMultiSelected && isSelectedForGen && !isBase && "ring-2 ring-foreground/70 shadow-md",
                    !selectedItem && !isMultiSelected && !isBase && !isSelectedForGen && "hover:ring-1 hover:ring-border",
                    markerPlacementMode !== null && isBase && "cursor-crosshair ring-2 ring-primary animate-pulse",
                  )}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  onMouseDown={(e) => handleImageMouseDown(e, item, e.currentTarget)}
                >
                  <img
                    src={item.src || "/placeholder.svg"}
                    alt={item.item?.name || item.type === "generated" ? "Generated" : "Room"}
                    className="w-full h-full object-contain pointer-events-none"
                    draggable={false}
                  />

                  {/* Render markers on base image */}
                  {isBase && item.markers && item.markers.map((marker) => renderMarker(marker))}

                  {isBase && isMouseDown && isDragging && lassoPoints.length > 1 && (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <polyline
                        points={lassoPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        className="stroke-foreground"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                      />
                    </svg>
                  )}

                  {/* Base badge */}
                  {isBase && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-foreground text-background text-xs font-medium">
                      <Crown className="w-3 h-3" />
                      Base
                    </div>
                  )}

                  {refNumber !== undefined && !isBase && (
                    <div className="absolute top-2 left-2 flex items-center justify-center w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold">
                      {refNumber}
                    </div>
                  )}


                  {/* Upscaling overlay */}
                  {upscalingItems.has(item.id) && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-foreground text-background text-sm font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Upscaling...
                      </div>
                    </div>
                  )}

                  {/* Removing background overlay */}
                  {removingBgItems.has(item.id) && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-foreground text-background text-sm font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Removing background...
                      </div>
                    </div>
                  )}

                  {/* Generated badge */}
                  {item.type === "generated" && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-foreground text-background text-xs font-medium">
                      <span>✦</span>
                      Generated
                    </div>
                  )}
                </div>
              </Rnd>
            )
          })}
        </div>

        {/* Empty State */}
        {!hasItems && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                <Upload className="w-10 h-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">Upload a room photo</p>
                <p className="text-sm text-muted-foreground">Drag and drop or click to upload</p>
              </div>
              <label className="pointer-events-auto">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" className="cursor-pointer bg-transparent" asChild>
                  <span>Choose File</span>
                </Button>
              </label>
            </div>
          </div>
        )}

        {/* Selected Item Toolbar - positioned above the image */}
        {selectedItem && (() => {
          const item = items.find(i => i.id === selectedItem)
          if (!item) return null
          const isUpscaling = upscalingItems.has(item.id)
          const isRemovingBg = removingBgItems.has(item.id)
          const isSelectedForGen = selectedForGeneration.has(item.id)
          const isBase = item.id === baseImageId

          // Calculate position above the image
          const toolbarX = item.x * zoom + panOffset.x + (item.width * zoom) / 2
          const toolbarY = item.y * zoom + panOffset.y - 12

          return (
            <div
              className="absolute z-50 flex flex-col items-center gap-1.5 pointer-events-none"
              style={{
                left: toolbarX,
                top: toolbarY,
                transform: 'translate(-50%, -100%)',
              }}
            >
              {/* Main toolbar */}
              <div className="flex items-center gap-1 bg-card/95 backdrop-blur-md border border-border rounded-xl px-2 py-1.5 shadow-lg pointer-events-auto">
                {/* Selection toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleGenerationSelection(item.id)
                  }}
                  className={cn(
                    "h-8 px-3 rounded-lg flex items-center gap-2 text-sm transition-colors",
                    isSelectedForGen
                      ? "bg-foreground text-background"
                      : "hover:bg-muted"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                    isSelectedForGen
                      ? "border-background bg-background"
                      : "border-current"
                  )}>
                    {isSelectedForGen && <Check className="w-3 h-3 text-foreground" />}
                  </div>
                  <span>Select</span>
                </button>

                {/* Set as Base - only show if selected for generation but not already base */}
                {isSelectedForGen && !isBase && (
                  <>
                    <div className="w-px h-5 bg-border" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 gap-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSetBase(item.id)
                      }}
                    >
                      <Crown className="w-4 h-4" />
                      <span className="text-sm">Set as Base</span>
                    </Button>
                  </>
                )}

                <div className="w-px h-5 bg-border" />

                {/* Upscale */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpscaleItem(item)
                  }}
                  disabled={isUpscaling || isRemovingBg}
                >
                  <ArrowUpFromLine className="w-4 h-4" />
                  <span className="text-sm">Upscale</span>
                </Button>

                {/* Remove Background */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveBgItem(item)
                  }}
                  disabled={isUpscaling || isRemovingBg}
                >
                  <Eraser className="w-4 h-4" />
                  <span className="text-sm">Remove bg</span>
                </Button>

                {/* Download */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDownloadItem(item)
                  }}
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Download</span>
                </Button>
              </div>

              {/* Image info */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{item.type === "generated" ? "Generated" : item.type === "room" ? "Room" : "Furniture"}</span>
                </div>
                <span className="tabular-nums">{Math.round(item.width)} × {Math.round(item.height)}</span>
              </div>
            </div>
          )
        })()}

        {/* Zoom Controls */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-card/95 backdrop-blur-md border border-border rounded-xl px-2 py-1.5 shadow-lg z-40">
          <Button size="icon" variant="ghost" disabled className="h-8 w-8 text-muted-foreground">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" disabled className="h-8 w-8 text-muted-foreground">
            <Redo2 className="w-4 h-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button size="icon" variant="ghost" onClick={handleZoomOut} className="h-8 w-8">
            <Minus className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground w-12 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button size="icon" variant="ghost" onClick={handleZoomIn} className="h-8 w-8">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  },
)

InfiniteCanvas.displayName = "InfiniteCanvas"
