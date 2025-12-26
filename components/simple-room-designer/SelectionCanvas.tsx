"use client"

import { useRef, useEffect, useCallback, useState } from "react"

interface SelectionCanvasProps {
  width: number
  height: number
  isDrawing: boolean
  brushSize?: number
  onSelectionChange: (hasSelection: boolean, maskDataUrl: string | null) => void
}

export function SelectionCanvas({
  width,
  height,
  isDrawing,
  brushSize = 30,
  onSelectionChange,
}: SelectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [hasStrokes, setHasStrokes] = useState(false)

  // Initialize canvases
  useEffect(() => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    // Set canvas dimensions
    canvas.width = width
    canvas.height = height
    maskCanvas.width = width
    maskCanvas.height = height

    // Clear both canvases
    const ctx = canvas.getContext("2d")
    const maskCtx = maskCanvas.getContext("2d")
    if (ctx) {
      ctx.clearRect(0, 0, width, height)
    }
    if (maskCtx) {
      maskCtx.fillStyle = "black"
      maskCtx.fillRect(0, 0, width, height)
    }
  }, [width, height])

  // Get position from event (mouse or touch)
  const getPosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ("touches" in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    }
  }, [])

  // Draw a stroke between two points
  const drawStroke = useCallback((
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext("2d")
    const maskCtx = maskCanvas.getContext("2d")
    if (!ctx || !maskCtx) return

    // Draw on visible canvas (terracotta with transparency)
    ctx.strokeStyle = "rgba(196, 101, 58, 0.5)"
    ctx.fillStyle = "rgba(196, 101, 58, 0.5)"
    ctx.lineWidth = brushSize
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()

    // Draw circles at endpoints for smooth strokes
    ctx.beginPath()
    ctx.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw on mask canvas (white on black)
    maskCtx.strokeStyle = "white"
    maskCtx.fillStyle = "white"
    maskCtx.lineWidth = brushSize
    maskCtx.lineCap = "round"
    maskCtx.lineJoin = "round"

    maskCtx.beginPath()
    maskCtx.moveTo(from.x, from.y)
    maskCtx.lineTo(to.x, to.y)
    maskCtx.stroke()

    maskCtx.beginPath()
    maskCtx.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2)
    maskCtx.fill()
  }, [brushSize])

  // Handle start drawing
  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()

    const pos = getPosition(e)
    if (!pos) return

    isDrawingRef.current = true
    lastPointRef.current = pos

    // Draw initial point
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext("2d")
    const maskCtx = maskCanvas.getContext("2d")
    if (!ctx || !maskCtx) return

    // Visible canvas
    ctx.fillStyle = "rgba(196, 101, 58, 0.5)"
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()

    // Mask canvas
    maskCtx.fillStyle = "white"
    maskCtx.beginPath()
    maskCtx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2)
    maskCtx.fill()

    setHasStrokes(true)
  }, [isDrawing, getPosition, brushSize])

  // Handle drawing
  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawingRef.current) return
    e.preventDefault()

    const pos = getPosition(e)
    if (!pos || !lastPointRef.current) return

    drawStroke(lastPointRef.current, pos)
    lastPointRef.current = pos
  }, [isDrawing, getPosition, drawStroke])

  // Handle end drawing
  const handleEnd = useCallback(() => {
    if (!isDrawingRef.current) return

    isDrawingRef.current = false
    lastPointRef.current = null

    // Export mask and notify parent
    const maskCanvas = maskCanvasRef.current
    if (maskCanvas && hasStrokes) {
      const maskDataUrl = maskCanvas.toDataURL("image/png")
      onSelectionChange(true, maskDataUrl)
    }
  }, [hasStrokes, onSelectionChange])

  // Clear selection
  const clearSelection = useCallback(() => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext("2d")
    const maskCtx = maskCanvas.getContext("2d")
    if (!ctx || !maskCtx) return

    ctx.clearRect(0, 0, width, height)
    maskCtx.fillStyle = "black"
    maskCtx.fillRect(0, 0, width, height)

    setHasStrokes(false)
    onSelectionChange(false, null)
  }, [width, height, onSelectionChange])

  // Expose clear method via ref-like pattern
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      (canvas as any).clearSelection = clearSelection
    }
  }, [clearSelection])

  // Update parent when strokes change
  useEffect(() => {
    if (hasStrokes) {
      const maskCanvas = maskCanvasRef.current
      if (maskCanvas) {
        const maskDataUrl = maskCanvas.toDataURL("image/png")
        onSelectionChange(true, maskDataUrl)
      }
    }
  }, [hasStrokes, onSelectionChange])

  return (
    <>
      {/* Visible selection canvas */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${isDrawing ? "cursor-crosshair" : "pointer-events-none"}`}
        style={{
          width: "100%",
          height: "100%",
          touchAction: isDrawing ? "none" : "auto",
        }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
      />
      {/* Hidden mask canvas (black bg, white strokes) */}
      <canvas
        ref={maskCanvasRef}
        style={{ display: "none" }}
      />
    </>
  )
}

// Export a hook for external control
export function useSelectionCanvas() {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [hasSelection, setHasSelection] = useState(false)
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const handleSelectionChange = useCallback((has: boolean, mask: string | null) => {
    setHasSelection(has)
    setMaskDataUrl(mask)
  }, [])

  const clearSelection = useCallback(() => {
    if (canvasRef.current && (canvasRef.current as any).clearSelection) {
      (canvasRef.current as any).clearSelection()
    }
    setHasSelection(false)
    setMaskDataUrl(null)
  }, [])

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => !prev)
  }, [])

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false)
  }, [])

  return {
    isSelectionMode,
    hasSelection,
    maskDataUrl,
    canvasRef,
    toggleSelectionMode,
    exitSelectionMode,
    clearSelection,
    handleSelectionChange,
  }
}
