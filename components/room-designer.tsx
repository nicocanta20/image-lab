"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { InfiniteCanvas } from "./infinite-canvas"
import { LeftToolbar, type Tool } from "./left-toolbar"
import { FloatingPromptBar, type GenerationSettings } from "./floating-prompt-bar"
import { GenerationQueue, type QueueJob } from "./generation-queue"
import { TopBar } from "./top-bar"

export type FurnitureItem = {
  id: string
  name: string
  image: string
  category: string
}

export type MarkerType = "pin" | "lasso"

export type Pin = {
  id: string
  referenceNumber: number
  x: number
  y: number
  type: "pin"
}

export type Lasso = {
  id: string
  referenceNumber: number
  points: { x: number; y: number }[]
  type: "lasso"
}

export type Marker = Pin | Lasso

export type PlacedItem = {
  id: string
  type: "room" | "furniture" | "generated"
  src: string
  x: number
  y: number
  width: number
  height: number
  aspectRatio: number
  markers?: Marker[]
  item?: FurnitureItem
}

// Colors for each reference number
export const REFERENCE_COLORS = [
  "#000000", // All markers will be black (inverted to white in dark mode via CSS)
  "#000000",
  "#000000",
  "#000000",
  "#000000",
  "#000000",
  "#000000",
  "#000000",
]

export const getColorForReference = (refNumber: number): string => {
  return "currentColor" // Will inherit from text color (black in light, white in dark)
}

async function imageUrlToBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) {
    return url
  }
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Resize image to max 1568px and ensure base64 output (AI APIs auto-downscale beyond this anyway)
async function resizeImage(imageUrl: string): Promise<string> {
  const MAX_SIZE = 1568
  const QUALITY = 0.9

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const { width, height } = img
      const longestEdge = Math.max(width, height)

      // Always convert to base64 via canvas (handles both resize and format conversion)
      const scale = longestEdge > MAX_SIZE ? MAX_SIZE / longestEdge : 1
      const newWidth = Math.round(width * scale)
      const newHeight = Math.round(height * scale)

      const canvas = document.createElement("canvas")
      canvas.width = newWidth
      canvas.height = newHeight
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, newWidth, newHeight)
      resolve(canvas.toDataURL("image/jpeg", QUALITY))
    }
    img.onerror = () => resolve(imageUrl)
    img.src = imageUrl
  })
}

type ReferenceInfo = { referenceNumber: number; name: string }

async function renderBaseWithMarkers(
  baseItem: PlacedItem,
  referenceInfos: ReferenceInfo[]
): Promise<string> {
  const img = new Image()
  img.crossOrigin = "anonymous"

  const imageData = baseItem.src.startsWith("data:") ? baseItem.src : await imageUrlToBase64(baseItem.src)

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = imageData
  })

  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")!

  ctx.drawImage(img, 0, 0)

  const markers = baseItem.markers || []
  const fontSize = Math.max(16, Math.min(24, canvas.width * 0.02))

  for (const marker of markers) {
    // Get object name for this reference
    const refInfo = referenceInfos.find((r) => r.referenceNumber === marker.referenceNumber)
    const objectName = refInfo?.name || "Object"

    if (marker.type === "pin") {
      const x = (marker.x / 100) * canvas.width
      const y = (marker.y / 100) * canvas.height

      const circleRadius = fontSize * 0.8
      const padding = 6

      // Draw number circle at click point
      ctx.beginPath()
      ctx.arc(x, y, circleRadius, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(0, 0, 0, 0.9)"
      ctx.fill()
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.font = `bold ${fontSize}px sans-serif`
      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(String(marker.referenceNumber), x, y)

      // Draw label to the right of the number
      const labelX = x + circleRadius + 4
      const textWidth = ctx.measureText(objectName).width
      const boxHeight = fontSize + padding * 2
      const boxWidth = textWidth + padding * 2

      ctx.fillStyle = "rgba(0, 0, 0, 0.85)"
      ctx.beginPath()
      ctx.roundRect(labelX, y - boxHeight / 2, boxWidth, boxHeight, 4)
      ctx.fill()

      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      ctx.fillText(objectName, labelX + padding, y)

    } else if (marker.type === "lasso" && marker.points.length > 2) {
      // Draw lasso outline
      ctx.beginPath()
      const firstPoint = marker.points[0]
      ctx.moveTo((firstPoint.x / 100) * canvas.width, (firstPoint.y / 100) * canvas.height)

      for (let i = 1; i < marker.points.length; i++) {
        const point = marker.points[i]
        ctx.lineTo((point.x / 100) * canvas.width, (point.y / 100) * canvas.height)
      }
      ctx.closePath()

      ctx.fillStyle = "rgba(0, 0, 0, 0.15)"
      ctx.fill()
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 2
      ctx.setLineDash([8, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // Draw label at centroid with number on left, name on right
      const centroidX = marker.points.reduce((sum, p) => sum + p.x, 0) / marker.points.length
      const centroidY = marker.points.reduce((sum, p) => sum + p.y, 0) / marker.points.length
      const cx = (centroidX / 100) * canvas.width
      const cy = (centroidY / 100) * canvas.height

      const circleRadius = fontSize * 0.8
      const padding = 6

      // Draw number circle
      ctx.beginPath()
      ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(0, 0, 0, 0.9)"
      ctx.fill()
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.font = `bold ${fontSize}px sans-serif`
      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(String(marker.referenceNumber), cx, cy)

      // Draw label to the right
      const labelX = cx + circleRadius + 4
      const textWidth = ctx.measureText(objectName).width
      const boxHeight = fontSize + padding * 2
      const boxWidth = textWidth + padding * 2

      ctx.fillStyle = "rgba(0, 0, 0, 0.85)"
      ctx.beginPath()
      ctx.roundRect(labelX, cy - boxHeight / 2, boxWidth, boxHeight, 4)
      ctx.fill()

      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      ctx.fillText(objectName, labelX + padding, cy)
    }
  }

  return canvas.toDataURL("image/jpeg", 0.9)
}

export function RoomDesigner() {
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([])
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [selectedForGeneration, setSelectedForGeneration] = useState<Set<string>>(new Set())
  const [prompt, setPrompt] = useState("")
  const [baseImageId, setBaseImageId] = useState<string | null>(null)
  const [markerPlacementMode, setMarkerPlacementMode] = useState<{
    refNumber: number
  } | null>(null)
  const [activeTool, setActiveTool] = useState<Tool>("select")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [queue, setQueue] = useState<QueueJob[]>([])
  const activeJobsRef = useRef<Set<string>>(new Set())
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const MAX_PARALLEL_JOBS = 3

  const [upscalingItems, setUpscalingItems] = useState<Set<string>>(new Set())
  const [removingBgItems, setRemovingBgItems] = useState<Set<string>>(new Set())

  const getReferenceImages = useCallback(() => {
    return placedItems
      .filter((item) => selectedForGeneration.has(item.id) && item.id !== baseImageId)
      .map((item, index) => ({ ...item, referenceNumber: index + 1 }))
  }, [placedItems, selectedForGeneration, baseImageId])

  const handleToggleGenerationSelection = useCallback(
    (id: string) => {
      setSelectedForGeneration((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(id)) {
          newSet.delete(id)
          if (id === baseImageId) {
            setBaseImageId(null)
          }
        } else {
          // Count current references (excluding base)
          const currentRefs = Array.from(prev).filter((itemId) => itemId !== baseImageId).length
          // Only allow adding if under max 3 references, or if this will be the base
          if (currentRefs < 3 || id === baseImageId) {
            newSet.add(id)
          }
        }
        return newSet
      })
    },
    [baseImageId],
  )

  const handleSetBase = useCallback(
    (id: string) => {
      if (baseImageId === id) {
        setBaseImageId(null)
      } else {
        setBaseImageId(id)
        setSelectedForGeneration((prev) => {
          const newSet = new Set(prev)
          newSet.add(id)
          return newSet
        })
      }
    },
    [baseImageId],
  )

  const handleAddPin = useCallback(
    (x: number, y: number) => {
      if (!baseImageId || !markerPlacementMode) return

      setPlacedItems((prev) =>
        prev.map((item) => {
          if (item.id === baseImageId) {
            const existingMarkers = item.markers || []
            const filteredMarkers = existingMarkers.filter((m) => m.referenceNumber !== markerPlacementMode.refNumber)
            return {
              ...item,
              markers: [
                ...filteredMarkers,
                {
                  id: `pin-${Date.now()}`,
                  referenceNumber: markerPlacementMode.refNumber,
                  x,
                  y,
                  type: "pin" as const,
                },
              ],
            }
          }
          return item
        }),
      )
      setMarkerPlacementMode(null)
    },
    [baseImageId, markerPlacementMode],
  )

  const handleAddLasso = useCallback(
    (points: { x: number; y: number }[]) => {
      if (!baseImageId || !markerPlacementMode) return
      if (points.length < 3) return

      setPlacedItems((prev) =>
        prev.map((item) => {
          if (item.id === baseImageId) {
            const existingMarkers = item.markers || []
            const filteredMarkers = existingMarkers.filter((m) => m.referenceNumber !== markerPlacementMode.refNumber)
            return {
              ...item,
              markers: [
                ...filteredMarkers,
                {
                  id: `lasso-${Date.now()}`,
                  referenceNumber: markerPlacementMode.refNumber,
                  points,
                  type: "lasso" as const,
                },
              ],
            }
          }
          return item
        }),
      )
      setMarkerPlacementMode(null)
    },
    [baseImageId, markerPlacementMode],
  )

  const handleRemoveMarker = useCallback(
    (markerId: string) => {
      if (!baseImageId) return
      setPlacedItems((prev) =>
        prev.map((item) => {
          if (item.id === baseImageId && item.markers) {
            return { ...item, markers: item.markers.filter((m) => m.id !== markerId) }
          }
          return item
        }),
      )
    },
    [baseImageId],
  )

  const handleRoomUpload = useCallback(async (imageUrl: string, filename?: string) => {
    // Compress image on upload to keep canvas fast and avoid API limits
    const compressed = await resizeImage(imageUrl)

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = async () => {
      const aspectRatio = img.width / img.height
      const maxWidth = 800
      const maxHeight = 600
      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        width = maxWidth
        height = width / aspectRatio
      }
      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }

      const itemId = `room-${Date.now()}`

      // Add item immediately with placeholder name
      const newRoom: PlacedItem = {
        id: itemId,
        type: "room",
        src: compressed,
        x: 100,
        y: 100,
        width,
        height,
        aspectRatio,
        markers: [],
        item: { id: itemId, name: "Analyzing...", image: compressed, category: "room" },
      }
      setPlacedItems((prev) => [...prev, newRoom])

      // Call API to get image description
      try {
        const response = await fetch("/api/describe-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: compressed, filename }),
        })
        const data = await response.json()
        if (data.success && data.name) {
          setPlacedItems((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? { ...item, item: { ...item.item!, name: data.name } }
                : item
            )
          )
        }
      } catch (error) {
        // Fallback to generic name
        setPlacedItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, item: { ...item.item!, name: "Uploaded Image" } }
              : item
          )
        )
      }
    }
    img.src = compressed
  }, [])

  const handleFurnitureAdd = useCallback(async (item: FurnitureItem) => {
    const itemId = `${item.id}-${Date.now()}`

    // Compress furniture image
    const compressed = await resizeImage(item.image)

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const aspectRatio = img.width / img.height
      const baseSize = 150
      let width = baseSize
      let height = baseSize / aspectRatio

      if (height > baseSize) {
        height = baseSize
        width = baseSize * aspectRatio
      }

      const newFurniture: PlacedItem = {
        id: itemId,
        type: "furniture",
        item,
        src: compressed,
        x: 200 + Math.random() * 200,
        y: 200 + Math.random() * 200,
        width,
        height,
        aspectRatio,
      }
      setPlacedItems((prev) => [...prev, newFurniture])
    }
    img.src = compressed
  }, [])

  const handleItemUpdate = useCallback((id: string, updates: Partial<PlacedItem>) => {
    setPlacedItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }, [])

  const handleItemDelete = useCallback(
    (id: string) => {
      // Check if deleted item was a reference - need to clean up its markers
      const refImages = getReferenceImages()
      const deletedRef = refImages.find((r) => r.id === id)

      if (deletedRef && baseImageId) {
        // Remove markers for this reference from the base image
        setPlacedItems((prev) =>
          prev.map((item) => {
            if (item.id === baseImageId && item.markers) {
              return {
                ...item,
                markers: item.markers.filter((m) => m.referenceNumber !== deletedRef.referenceNumber),
              }
            }
            return item
          }).filter((item) => item.id !== id)
        )
      } else {
        setPlacedItems((prev) => prev.filter((item) => item.id !== id))
      }

      setSelectedItem(null)
      setMarkerPlacementMode(null) // Cancel any marker placement
      setSelectedForGeneration((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
      if (baseImageId === id) {
        setBaseImageId(null)
        // Clear all markers since base is deleted
        setPlacedItems((prev) =>
          prev.map((item) => ({ ...item, markers: [] }))
        )
      }
    },
    [baseImageId, getReferenceImages],
  )

  const handleItemsDelete = useCallback(
    (ids: string[]) => {
      // Get reference numbers for deleted references to clean up markers
      const refImages = getReferenceImages()
      const deletedRefNumbers = refImages
        .filter((r) => ids.includes(r.id))
        .map((r) => r.referenceNumber)

      setPlacedItems((prev) => {
        let items = prev.filter((item) => !ids.includes(item.id))

        // Clean up markers for deleted references
        if (deletedRefNumbers.length > 0 && baseImageId && !ids.includes(baseImageId)) {
          items = items.map((item) => {
            if (item.id === baseImageId && item.markers) {
              return {
                ...item,
                markers: item.markers.filter((m) => !deletedRefNumbers.includes(m.referenceNumber)),
              }
            }
            return item
          })
        }

        // Clear all markers if base was deleted
        if (baseImageId && ids.includes(baseImageId)) {
          items = items.map((item) => ({ ...item, markers: [] }))
        }

        return items
      })

      setSelectedItem(null)
      setMarkerPlacementMode(null)
      setSelectedForGeneration((prev) => {
        const newSet = new Set(prev)
        ids.forEach((id) => newSet.delete(id))
        return newSet
      })
      if (baseImageId && ids.includes(baseImageId)) {
        setBaseImageId(null)
      }
    },
    [baseImageId, getReferenceImages],
  )

  const handleDownloadItem = useCallback((item: PlacedItem) => {
    const link = document.createElement("a")
    link.href = item.src
    link.download =
      item.type === "generated"
        ? `generated-room-${Date.now()}.png`
        : `${item.item?.name || item.type}-${Date.now()}.png`
    link.click()
  }, [])

  const handleUpscaleItem = useCallback(async (item: PlacedItem) => {
    // Mark as upscaling
    setUpscalingItems((prev) => new Set(prev).add(item.id))

    try {
      const response = await fetch("/api/upscale-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: item.src }),
      })

      const data = await response.json()

      if (data.success && data.image) {
        // Add upscaled image as new item next to original
        const upscaledItem: PlacedItem = {
          id: `upscaled-${Date.now()}`,
          type: item.type,
          src: data.image,
          x: item.x + item.width + 20,
          y: item.y,
          width: data.width ? Math.min(data.width, item.width * 2) : item.width * 2,
          height: data.height ? Math.min(data.height, item.height * 2) : item.height * 2,
          aspectRatio: item.aspectRatio,
          item: item.item ? { ...item.item, name: `${item.item.name} (2x)` } : undefined,
        }
        setPlacedItems((prev) => [...prev, upscaledItem])
      } else {
        console.error("Upscale failed:", data.error)
      }
    } catch (error) {
      console.error("Upscale error:", error)
    } finally {
      setUpscalingItems((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }, [])

  const handleRemoveBgItem = useCallback(async (item: PlacedItem) => {
    setRemovingBgItems((prev) => new Set(prev).add(item.id))

    try {
      const response = await fetch("/api/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: item.src }),
      })

      const data = await response.json()

      if (data.success && data.image) {
        const newItem: PlacedItem = {
          id: `nobg-${Date.now()}`,
          type: item.type,
          src: data.image,
          x: item.x + item.width + 20,
          y: item.y,
          width: data.width || item.width,
          height: data.height || item.height,
          aspectRatio: item.aspectRatio,
          item: item.item ? { ...item.item, name: `${item.item.name} (no bg)` } : undefined,
        }
        setPlacedItems((prev) => [...prev, newItem])
      } else {
        console.error("Remove background failed:", data.error)
      }
    } catch (error) {
      console.error("Remove background error:", error)
    } finally {
      setRemovingBgItems((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }, [])

  const getBaseAspectRatio = useCallback(() => {
    if (!baseImageId) return 16 / 9
    const baseItem = placedItems.find((item) => item.id === baseImageId)
    return baseItem?.aspectRatio || 16 / 9
  }, [baseImageId, placedItems])

  useEffect(() => {
    const processQueue = async () => {
      const pendingJobs = queue.filter((j) => j.status === "pending")
      const processingCount = queue.filter((j) => j.status === "processing").length

      // Start new jobs if under limit
      const slotsAvailable = MAX_PARALLEL_JOBS - processingCount
      const jobsToStart = pendingJobs.slice(0, slotsAvailable)

      for (const job of jobsToStart) {
        if (activeJobsRef.current.has(job.id)) continue
        activeJobsRef.current.add(job.id)

        // Mark as processing
        setQueue((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, status: "processing" as const, startedAt: Date.now() } : j)),
        )

        // Create abort controller for this job
        const abortController = new AbortController()
        abortControllersRef.current.set(job.id, abortController)

        // Execute the job (this is async but we don't await - parallel execution)
        executeJob(job.id, abortController.signal)
      }
    }

    processQueue()
  }, [queue])

  const executeJob = async (jobId: string, signal: AbortSignal) => {
    const job = queue.find((j) => j.id === jobId)
    if (!job || !("payload" in job)) return

    const payload = (job as any).payload

    try {
      const response = await fetch("/api/generate-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      })

      if (signal.aborted) return

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.image) {
        const generatedSrc = `data:${data.image.mediaType};base64,${data.image.base64}`

        // Add to canvas
        const baseItem = placedItems.find((item) => item.id === payload.baseItemId)
        const genWidth = baseItem?.width || 500
        const genHeight = baseItem?.height || genWidth / (baseItem?.aspectRatio || 1)

        const positionRef = baseItem || placedItems[0]
        const generatedItem: PlacedItem = {
          id: `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "generated",
          src: generatedSrc,
          x: (positionRef?.x || 100) + (positionRef?.width || 400) + 50 + Math.random() * 100,
          y: (positionRef?.y || 100) + Math.random() * 100,
          width: genWidth,
          height: genHeight,
          aspectRatio: baseItem?.aspectRatio || 1,
        }

        setPlacedItems((prev) => [...prev, generatedItem])

        // Mark job as completed
        setQueue((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, status: "completed" as const, completedAt: Date.now(), result: generatedSrc } : j,
          ),
        )
      }
    } catch (error) {
      if (signal.aborted) return

      setQueue((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "failed" as const,
                completedAt: Date.now(),
                error: error instanceof Error ? error.message : "Unknown error",
              }
            : j,
        ),
      )
    } finally {
      activeJobsRef.current.delete(jobId)
      abortControllersRef.current.delete(jobId)
    }
  }

  const handleCancelJob = useCallback((jobId: string) => {
    const controller = abortControllersRef.current.get(jobId)
    if (controller) {
      controller.abort()
    }
    setQueue((prev) => prev.filter((j) => j.id !== jobId))
    activeJobsRef.current.delete(jobId)
    abortControllersRef.current.delete(jobId)
  }, [])

  const handleClearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((j) => j.status === "pending" || j.status === "processing"))
  }, [])

  const handleClearAll = useCallback(() => {
    // Abort all active jobs
    abortControllersRef.current.forEach((controller) => controller.abort())
    abortControllersRef.current.clear()
    activeJobsRef.current.clear()
    setQueue([])
  }, [])

  const handleGenerate = async (settings: GenerationSettings) => {
    if (selectedForGeneration.size === 0) return

    const baseItem = placedItems.find((item) => item.id === baseImageId)
    const referenceItems = getReferenceImages()

    // Get base dimensions
    let baseWidth = 1024
    let baseHeight = 1024

    if (baseItem) {
      const img = new Image()
      img.crossOrigin = "anonymous"
      await new Promise<void>((resolve) => {
        img.onload = () => {
          baseWidth = img.naturalWidth
          baseHeight = img.naturalHeight
          resolve()
        }
        img.onerror = () => resolve()
        img.src = baseItem.src
      })
    }

    // Build reference info for markers
    const referenceInfos: ReferenceInfo[] = referenceItems.map((r) => ({
      referenceNumber: r.referenceNumber,
      name: r.item?.name || r.type || "Object",
    }))

    // Prepare images (already compressed on upload)
    const imagesToSend: { role: string; data: string; referenceNumber?: number; name?: string }[] = []

    if (baseItem) {
      const baseWithMarkers = await renderBaseWithMarkers(baseItem, referenceInfos)
      imagesToSend.push({ role: "base", data: baseWithMarkers })
    }

    for (const refItem of referenceItems) {
      imagesToSend.push({
        role: "reference",
        data: refItem.src,
        referenceNumber: refItem.referenceNumber,
        name: refItem.item?.name || refItem.type || "Object",
      })
    }

    const markersWithNames = (baseItem?.markers || []).map((m) => {
      const refInfo = referenceInfos.find((r) => r.referenceNumber === m.referenceNumber)
      return {
        ...m,
        objectName: refInfo?.name || "Object",
      }
    })

    // Generate a name for the job
    const jobName = prompt.trim()
      ? prompt.trim().slice(0, 30) + (prompt.length > 30 ? "..." : "")
      : `Generation ${queue.length + 1}`

    // Create a new job
    const newJob: QueueJob & { payload: any } = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: jobName,
      status: "pending",
      payload: {
        images: imagesToSend,
        hasBase: !!baseItem,
        referenceCount: referenceItems.length,
        markers: markersWithNames,
        prompt,
        settings,
        baseWidth,
        baseHeight,
        baseItemId: baseImageId,
      },
    }

    setQueue((prev) => [...prev, newJob])
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Top Bar */}
      <TopBar />

      {/* Infinite Canvas */}
      <InfiniteCanvas
        items={placedItems}
        selectedItem={selectedItem}
        selectedForGeneration={selectedForGeneration}
        baseImageId={baseImageId}
        markerPlacementMode={markerPlacementMode}
        activeTool={activeTool}
        upscalingItems={upscalingItems}
        removingBgItems={removingBgItems}
        onItemSelect={setSelectedItem}
        onToggleGenerationSelection={handleToggleGenerationSelection}
        onSetBase={handleSetBase}
        onItemUpdate={handleItemUpdate}
        onItemDelete={handleItemDelete}
        onItemsDelete={handleItemsDelete}
        onRoomUpload={handleRoomUpload}
        onDownloadItem={handleDownloadItem}
        onUpscaleItem={handleUpscaleItem}
        onRemoveBgItem={handleRemoveBgItem}
        onAddPin={handleAddPin}
        onAddLasso={handleAddLasso}
        onRemoveMarker={handleRemoveMarker}
        getReferenceImages={getReferenceImages}
      />

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            const filename = file.name
            const reader = new FileReader()
            reader.onload = (event) => {
              const imageUrl = event.target?.result as string
              if (imageUrl) {
                handleRoomUpload(imageUrl, filename)
              }
            }
            reader.readAsDataURL(file)
          }
          e.target.value = ""
        }}
      />

      {/* Left Toolbar */}
      <LeftToolbar
        onSelectItem={handleFurnitureAdd}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onUpload={() => fileInputRef.current?.click()}
      />

      {/* Floating Prompt Bar */}
      <FloatingPromptBar
        prompt={prompt}
        onPromptChange={setPrompt}
        onGenerate={handleGenerate}
        isGenerating={queue.some((j) => j.status === "processing")}
        selectedCount={selectedForGeneration.size}
        hasBase={!!baseImageId}
        baseImage={placedItems.find((item) => item.id === baseImageId)}
        referenceImages={getReferenceImages()}
        markerPlacementMode={markerPlacementMode}
        onStartMarkerPlacement={setMarkerPlacementMode}
        onCancelMarkerPlacement={() => setMarkerPlacementMode(null)}
      />

      <GenerationQueue
        jobs={queue}
        onCancelJob={handleCancelJob}
        onClearCompleted={handleClearCompleted}
        onClearAll={handleClearAll}
      />
    </div>
  )
}
