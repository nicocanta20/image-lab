"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { X } from "lucide-react"

interface LassoSelectionProps {
  width: number
  height: number
  isActive: boolean
  onSelectionComplete: (overlayDataUrl: string) => void
  onSelectionClear: () => void
}

export function LassoSelection({
  width,
  height,
  isActive,
  onSelectionComplete,
  onSelectionClear,
}: LassoSelectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const isDrawingRef = useRef(false)
  const pointsRef = useRef<{ x: number; y: number }[]>([])
  const [hasSelection, setHasSelection] = useState(false)

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0) return

    canvas.width = width
    canvas.height = height
  }, [width, height])

  // Get position from event
  const getPosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ("touches" in e) {
      const touch = e.touches[0]
      if (!touch) return null
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  // Draw lasso outline while dragging
  const drawLassoPath = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const points = pointsRef.current
    if (points.length < 2) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Dashed outline
    ctx.strokeStyle = "#c4653a"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.setLineDash([8, 6])

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Draw start point indicator
    ctx.fillStyle = "#c4653a"
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, 4, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  // Finalize selection - close path and fill
  const finalizeLasso = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const points = pointsRef.current
    if (points.length < 3) return

    // Clear and draw filled selection
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = "rgba(196, 101, 58, 0.25)"
    ctx.strokeStyle = "#c4653a"
    ctx.lineWidth = 2

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Export overlay - Gemini sees this on the image and understands what to edit
    const overlayDataUrl = canvas.toDataURL("image/png")
    onSelectionComplete(overlayDataUrl)
    setHasSelection(true)
  }, [onSelectionComplete])

  // Clear everything
  const clearSelection = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    pointsRef.current = []
    setHasSelection(false)
    onSelectionClear()
  }, [onSelectionClear])

  // Mouse/touch handlers
  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isActive) return
    e.preventDefault()
    e.stopPropagation()

    const pos = getPosition(e)
    if (!pos) return

    // Clear previous and start new
    clearSelection()
    isDrawingRef.current = true
    pointsRef.current = [pos]
  }, [isActive, getPosition, clearSelection])

  const handleMove = useCallback((e: React.MouseEvent | TouchEvent) => {
    if (!isActive || !isDrawingRef.current) return

    const pos = getPosition(e as React.MouseEvent | React.TouchEvent)
    if (!pos) return

    const lastPoint = pointsRef.current[pointsRef.current.length - 1]
    const dist = Math.hypot(pos.x - lastPoint.x, pos.y - lastPoint.y)

    if (dist > 4) {
      pointsRef.current.push(pos)
      drawLassoPath()
    }
  }, [isActive, getPosition, drawLassoPath])

  // Use native touch event listeners with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isActive) return

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDrawingRef.current) return
      e.preventDefault() // This now works with passive: false
      handleMove(e)
    }

    canvas.addEventListener("touchmove", handleTouchMove, { passive: false })
    return () => canvas.removeEventListener("touchmove", handleTouchMove)
  }, [isActive, handleMove])

  const handleEnd = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false

    if (pointsRef.current.length >= 3) {
      finalizeLasso()
    } else {
      clearSelection()
    }
  }, [finalizeLasso, clearSelection])

  return (
    <>
      {/* Selection canvas */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${isActive ? "cursor-crosshair" : "pointer-events-none"}`}
        style={{ width: "100%", height: "100%", touchAction: isActive ? "none" : "auto" }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
      />


      {/* Selection indicator chip */}
      {hasSelection && !isActive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-terracotta text-white text-xs font-medium rounded-full shadow-lg animate-in fade-in zoom-in-95 duration-200">
          <span>Area selected</span>
          <button
            onClick={clearSelection}
            className="p-0.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  )
}
