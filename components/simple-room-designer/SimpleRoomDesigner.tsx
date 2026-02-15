"use client"

import { useState, useCallback, useRef } from "react"
import { RoomImageViewer } from "./RoomImageViewer"
import { ReferencePanel } from "./ReferencePanel"
import { ResultsGallery } from "./ResultsGallery"
import { PromptInput } from "./PromptInput"
import { InlineQuestions, type Question } from "./InlineQuestions"
import { TopBar } from "../top-bar"
import { Upload, Layers, Image as ImageIcon } from "lucide-react"

// Reference number constants
export const REFERENCE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const
export type ReferenceNumber = (typeof REFERENCE_NUMBERS)[number]
export const MAX_REFERENCES = REFERENCE_NUMBERS.length

// Types
export type Marker = {
  id: string
  referenceNumber: number
  x: number
  y: number
}

export type RoomImage = {
  id: string
  src: string
  name: string
  aspectRatio: number
  naturalWidth: number
  naturalHeight: number
}

export type ReferenceImage = {
  id: string
  src: string
  name: string
  referenceNumber: ReferenceNumber
}

export type GenerationContext = {
  prompt: string
  clarifications?: string[]
  settings: {
    style: string
    lighting: string
  }
  roomDescription?: string
  references?: Array<{ name: string; referenceNumber: number }>
}

export type UpscaleMetadata = {
  originalWidth: number
  originalHeight: number
  upscaledWidth: number
  upscaledHeight: number
  scaleFactor: number
}

export type GeneratedResult = {
  id: string
  src: string
  createdAt: number
  isProcessing?: boolean
  isFavorite?: boolean
  context?: GenerationContext
  upscaleInfo?: UpscaleMetadata
}

export type GenerationSettings = {
  style: string
  lighting: string
  resolution: "1K" | "2K" | "4K"
  aspectRatio: "auto" | "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "3:2" | "2:3" | "21:9"
}

// Utility functions
async function compositeImages(baseUrl: string, overlayUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const baseImg = new Image()
    baseImg.crossOrigin = "anonymous"
    baseImg.onload = () => {
      const overlayImg = new Image()
      overlayImg.crossOrigin = "anonymous"
      overlayImg.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = baseImg.width
        canvas.height = baseImg.height
        const ctx = canvas.getContext("2d")!

        // Draw base image
        ctx.drawImage(baseImg, 0, 0)

        // Draw overlay on top (selection lasso)
        ctx.drawImage(overlayImg, 0, 0, baseImg.width, baseImg.height)

        resolve(canvas.toDataURL("image/jpeg", 0.9))
      }
      overlayImg.src = overlayUrl
    }
    baseImg.src = baseUrl
  })
}

async function resizeImage(imageUrl: string): Promise<string> {
  const MAX_SIZE = 1568
  const QUALITY = 0.9

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const { width, height } = img
      const longestEdge = Math.max(width, height)
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
    img.src = imageUrl
  })
}

async function describeImage(image: string, filename?: string): Promise<string> {
  try {
    const response = await fetch("/api/describe-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, filename }),
    })
    const data = await response.json()
    return data.success ? data.name : filename || "Uploaded image"
  } catch {
    return filename || "Uploaded image"
  }
}

export function SimpleRoomDesigner() {
  // Core state
  const [baseImage, setBaseImage] = useState<RoomImage | null>(null)
  const [references, setReferences] = useState<ReferenceImage[]>([])
  const [markers, setMarkers] = useState<Marker[]>([])
  const [results, setResults] = useState<GeneratedResult[]>([])

  // UI state
  const [activeReferenceForPlacement, setActiveReferenceForPlacement] = useState<number | null>(null)
  const [mobileTab, setMobileTab] = useState<"references" | "results">("references")

  // Generation state
  const [prompt, setPrompt] = useState("")
  const [settings, setSettings] = useState<GenerationSettings>({
    style: "photorealistic",
    lighting: "natural-daylight",
    resolution: "1K",
    aspectRatio: "auto",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [pendingQuestions, setPendingQuestions] = useState<Question[] | null>(null)
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set())

  // Selection/inpainting state - only need overlay (Gemini sees it visually)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectionOverlay, setSelectionOverlay] = useState<string | null>(null)
  const [selectedObjectDescription, setSelectedObjectDescription] = useState<string | null>(null)

  // Derived state
  const hasSelection = selectionOverlay !== null

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingContextRef = useRef<{ objectDescription: string | null; placementDescription: string | null; imageWithSelection: string | null }>({ objectDescription: null, placementDescription: null, imageWithSelection: null })

  // Handle room image upload
  const handleRoomUpload = useCallback(async (file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      const resized = await resizeImage(dataUrl)
      const name = await describeImage(resized, file.name)

      const img = new Image()
      img.onload = () => {
        setBaseImage({
          id: `room-${Date.now()}`,
          src: resized,
          name,
          aspectRatio: img.width / img.height,
          naturalWidth: img.width,
          naturalHeight: img.height,
        })
        // Clear previous markers when uploading new room
        setMarkers([])
      }
      img.src = resized
    }
    reader.readAsDataURL(file)
  }, [])

  // Handle reference image addition
  const handleAddReference = useCallback(async (src: string, name?: string) => {
    if (references.length >= MAX_REFERENCES) return

    const resized = await resizeImage(src)
    const finalName = name || (await describeImage(resized))
    const refNumber = references.length + 1

    setReferences((prev) => [
      ...prev,
      {
        id: `ref-${Date.now()}`,
        src: resized,
        name: finalName,
        referenceNumber: refNumber as ReferenceNumber,
      },
    ])
  }, [references.length])

  // Handle reference removal
  const handleRemoveReference = useCallback((id: string) => {
    const refToRemove = references.find((r) => r.id === id)

    setReferences((prev) => {
      const filtered = prev.filter((r) => r.id !== id)
      return filtered.map((r, i) => ({
        ...r,
        referenceNumber: (i + 1) as ReferenceNumber,
      }))
    })

    // Remove associated markers
    if (refToRemove) {
      setMarkers((prev) => prev.filter((m) => m.referenceNumber !== refToRemove.referenceNumber))
    }

    // Cancel placement mode if it was for this reference
    if (refToRemove && activeReferenceForPlacement === refToRemove.referenceNumber) {
      setActiveReferenceForPlacement(null)
    }
  }, [references, activeReferenceForPlacement])

  // Handle marker placement
  const handleAddPin = useCallback((x: number, y: number) => {
    if (activeReferenceForPlacement === null) return

    const newMarker: Marker = {
      id: `marker-${Date.now()}`,
      referenceNumber: activeReferenceForPlacement,
      x,
      y,
    }
    setMarkers((prev) => [...prev, newMarker])
    setActiveReferenceForPlacement(null)
  }, [activeReferenceForPlacement])

  const handleRemoveMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id))
  }, [])

  // Selection mode handlers
  const handleSelectionModeToggle = useCallback(() => {
    setIsSelectionMode((prev) => !prev)
    // Cancel placement mode when entering selection mode
    if (!isSelectionMode) {
      setActiveReferenceForPlacement(null)
    }
  }, [isSelectionMode])

  const handleSelectionChange = useCallback((_has: boolean, overlayDataUrl: string | null) => {
    setSelectionOverlay(overlayDataUrl)
    // Auto-exit selection mode once a selection is made
    if (overlayDataUrl) {
      setIsSelectionMode(false)
    }
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectionOverlay(null)
    setSelectedObjectDescription(null)
  }, [])

  // Render markers onto base image for API
  const renderBaseWithMarkers = useCallback(async (): Promise<string> => {
    if (!baseImage) return ""

    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")!

        ctx.drawImage(img, 0, 0)

        markers.forEach((marker) => {
          const x = (marker.x / 100) * img.width
          const y = (marker.y / 100) * img.height

          // Circle background
          ctx.beginPath()
          ctx.arc(x, y, 24, 0, Math.PI * 2)
          ctx.fillStyle = "#c4653a"
          ctx.fill()

          // Number only - no label to avoid AI reproducing it
          ctx.fillStyle = "#fff"
          ctx.font = "bold 16px system-ui"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(String(marker.referenceNumber), x, y)
        })

        resolve(canvas.toDataURL("image/jpeg", 0.9))
      }
      img.src = baseImage.src
    })
  }, [baseImage, markers, references])

  // Determine which API route to use based on available inputs
  // Each mode maps directly to an API: create → /api/create-image, edit → /api/edit-image, add-references → /api/add-references
  const generationMode: "create" | "edit" | "add-references" = !baseImage
    ? "create"           // No room uploaded → generate from scratch
    : references.length > 0
      ? "add-references" // Room + reference images → add items to room
      : "edit"           // Room only → edit/modify the room

  // Can generate if: has prompt (for create/edit) OR has references (for add-references mode)
  const canGenerate = generationMode === "add-references"
    ? references.length > 0
    : prompt.trim().length > 0

  // Build images array for API calls - send clean images only
  // Placement is described via natural language in the prompt
  const buildImagesArray = useCallback(async () => {
    const images: Array<{ role: string; data: string; name?: string; referenceNumber?: number }> = []

    if (baseImage) {
      images.push({ role: "base", data: baseImage.src, name: baseImage.name })
    }

    if (references.length > 0) {
      references.forEach((ref) => {
        images.push({
          role: "reference",
          data: ref.src,
          referenceNumber: ref.referenceNumber,
          name: ref.name,
        })
      })
    }

    return images
  }, [baseImage, references])

  // Actual generation call
  const executeGeneration = useCallback(async (
    naturalPhrases?: string[],
    objectDescription?: string | null,
    placementDescription?: string | null,
    imageWithSelection?: string | null
  ) => {
    setIsGenerating(true)

    try {
      // Build the final prompt - append natural phrases if any
      let finalPrompt = prompt
      if (naturalPhrases && naturalPhrases.length > 0) {
        finalPrompt = `${finalPrompt}. ${naturalPhrases.join(". ")}`
      }

      // Each mode: endpoint + payload builder
      const apiConfig = {
        "create": {
          endpoint: "/api/create-image",
          body: {
            prompt: finalPrompt,
            references: references.length > 0 ? references.map(ref => ({
              role: "reference",
              data: ref.src,
              name: ref.name,
              referenceNumber: ref.referenceNumber,
            })) : undefined,
            settings,
          },
        },
        "edit": {
          endpoint: "/api/edit-image",
          body: {
            baseImage: { role: "base", data: baseImage?.src, name: baseImage?.name },
            imageWithSelection, // Image with lasso overlay so model can SEE the selection
            prompt: finalPrompt,
            selectedObjectDescription: objectDescription,
            settings,
          },
        },
        "add-references": {
          endpoint: "/api/add-references",
          body: {
            baseImage: { role: "base", data: baseImage?.src, name: baseImage?.name },
            references: references.map(ref => ({
              role: "reference",
              data: ref.src,
              name: ref.name,
              referenceNumber: ref.referenceNumber,
              quantity: markers.filter(m => m.referenceNumber === ref.referenceNumber).length || 1,
            })),
            placementDescription, // Natural language description of where to place items
            prompt: finalPrompt,
            settings,
            baseWidth: baseImage?.naturalWidth,
            baseHeight: baseImage?.naturalHeight,
          },
        },
      } as const

      const { endpoint, body } = apiConfig[generationMode]
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      console.log(`[${generationMode}] ${endpoint}:`, data.success ? "success" : data.error)

      if (data.success && data.image) {
        // Build generation context for display
        const generationContext: GenerationContext = {
          prompt,
          clarifications: naturalPhrases,
          settings: { ...settings },
          roomDescription: baseImage?.name,
          references: references.map(r => ({ name: r.name, referenceNumber: r.referenceNumber })),
        }

        const newResult: GeneratedResult = {
          id: `gen-${Date.now()}`,
          src: `data:${data.image.mediaType};base64,${data.image.base64}`,
          createdAt: Date.now(),
          context: generationContext,
        }
        setResults((prev) => [newResult, ...prev])
      } else {
        console.error("Generation failed:", data.error || data.message || "Unknown error")
      }
    } catch (error) {
      console.error("Generation error:", error)
    } finally {
      setIsGenerating(false)
    }
  }, [buildImagesArray, baseImage, references, markers, prompt, settings, generationMode, hasSelection])

  // Handle generation - first analyze, then maybe ask questions
  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return

    setIsAnalyzing(true)

    try {
      const images = await buildImagesArray()

      // If there's a selection, create a composited image showing the lasso on the room
      let imageWithSelection: string | null = null
      let objectDescription: string | null = null

      if (hasSelection && selectionOverlay && baseImage) {
        imageWithSelection = await compositeImages(baseImage.src, selectionOverlay)

        // Identify what object is selected (quick vision call)
        try {
          const describeResponse = await fetch("/api/describe-selection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageWithSelection }),
          })
          const describeData = await describeResponse.json()
          if (describeData.success && describeData.description) {
            objectDescription = describeData.description
            setSelectedObjectDescription(objectDescription)
            console.log("Selected object identified:", objectDescription)
          }
        } catch (e) {
          console.error("Failed to identify selection:", e)
        }
      }

      // If there are markers, create image showing marker positions and get placement description
      let imageWithMarkers: string | null = null
      let placementDescription: string | null = null

      if (markers.length > 0 && baseImage) {
        imageWithMarkers = await renderBaseWithMarkers()

        // Get natural language description of placements
        try {
          const placementResponse = await fetch("/api/describe-placements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageWithMarkers,
              references: references.map(r => ({
                referenceNumber: r.referenceNumber,
                name: r.name,
                pinCount: markers.filter(m => m.referenceNumber === r.referenceNumber).length,
              })),
            }),
          })
          const placementData = await placementResponse.json()
          if (placementData.success && placementData.description) {
            placementDescription = placementData.description
            console.log("Placement description:", placementDescription)
          }
        } catch (e) {
          console.error("Failed to describe placements:", e)
        }
      }

      // Analyze the request
      const analyzeResponse = await fetch("/api/analyze-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          hasBase: !!baseImage,
          referenceCount: references.length,
          markers: markers.map((m) => ({
            referenceNumber: m.referenceNumber,
            x: m.x,
            y: m.y,
            type: "pin" as const,
          })),
          prompt,
          settings,
          imageWithSelection, // Room + lasso overlay (presence indicates inpainting mode)
          imageWithMarkers,   // Room + numbered markers showing placements
          selectedObjectDescription: objectDescription, // What object is selected
          generationMode, // create | modify | furniture
        }),
      })

      const analysis = await analyzeResponse.json()
      console.log("Analysis:", analysis)

      if (analysis.needsClarification && analysis.questions?.length > 0) {
        // Show questions - store context for later
        setPendingQuestions(analysis.questions)
        // Store descriptions for when user answers questions
        pendingContextRef.current = { objectDescription, placementDescription, imageWithSelection }
        setIsAnalyzing(false)
      } else {
        // No questions needed, proceed to generate
        setIsAnalyzing(false)
        await executeGeneration(undefined, objectDescription, placementDescription, imageWithSelection)
      }
    } catch (error) {
      console.error("Analysis error:", error)
      // On error, just proceed with generation
      setIsAnalyzing(false)
      await executeGeneration()
    }
  }, [canGenerate, buildImagesArray, baseImage, references, markers, prompt, settings, executeGeneration, hasSelection, selectionOverlay, renderBaseWithMarkers, generationMode])

  // Handle question answers
  const handleQuestionAnswers = useCallback(async (answers: Record<string, string | string[]>) => {
    // Get naturalPhrase from selected options, or use custom text directly
    const naturalPhrases: string[] = []

    for (const [questionId, answer] of Object.entries(answers)) {
      const question = pendingQuestions?.find(q => q.id === questionId)
      if (!question) continue

      // Handle single or multi-select
      const selectedValues = Array.isArray(answer) ? answer : [answer]
      for (const value of selectedValues) {
        // Try to find matching option by label (since we store labels, not values)
        const option = question.options?.find(o => o.label === value)
        if (option?.naturalPhrase) {
          naturalPhrases.push(option.naturalPhrase)
        } else if (value) {
          // Custom answer - use the text directly
          naturalPhrases.push(value)
        }
      }
    }

    setPendingQuestions(null)
    const { objectDescription, placementDescription, imageWithSelection } = pendingContextRef.current
    console.log("Generation with natural phrases:", naturalPhrases)
    await executeGeneration(naturalPhrases, objectDescription, placementDescription, imageWithSelection)
  }, [executeGeneration, pendingQuestions])

  // Handle skip questions
  const handleSkipQuestions = useCallback(async () => {
    setPendingQuestions(null)
    const { objectDescription, placementDescription, imageWithSelection } = pendingContextRef.current
    await executeGeneration(undefined, objectDescription, placementDescription, imageWithSelection)
  }, [executeGeneration])

  // Use a generated result as the new base image
  const handleUseAsBase = useCallback((result: GeneratedResult) => {
    const img = new Image()
    img.onload = () => {
      setBaseImage({
        id: `base-${Date.now()}`,
        src: result.src,
        name: "Generated Room",
        aspectRatio: img.width / img.height,
        naturalWidth: img.width,
        naturalHeight: img.height,
      })
      // Clear markers when changing base
      setMarkers([])
    }
    img.src = result.src
  }, [])

  // Result actions
  const handleDownload = useCallback((result: GeneratedResult) => {
    const link = document.createElement("a")
    link.href = result.src
    link.download = `room-design-${Date.now()}.png`
    link.click()
  }, [])

  const handleUpscale = useCallback(async (result: GeneratedResult) => {
    setProcessingItems((prev) => new Set(prev).add(result.id))

    try {
      // Get original dimensions
      const originalDims = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => resolve({ width: 0, height: 0 })
        img.src = result.src
      })

      const response = await fetch("/api/upscale-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: result.src }),
      })

      const data = await response.json()

      if (data.success && data.image) {
        const newResult: GeneratedResult = {
          id: `upscaled-${Date.now()}`,
          src: data.image,
          createdAt: Date.now(),
          upscaleInfo: {
            originalWidth: originalDims.width,
            originalHeight: originalDims.height,
            upscaledWidth: data.width || originalDims.width * 4,
            upscaledHeight: data.height || originalDims.height * 4,
            scaleFactor: 4,
          },
        }
        setResults((prev) => [newResult, ...prev])
      }
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev)
        next.delete(result.id)
        return next
      })
    }
  }, [])

  const handleRemoveBg = useCallback(async (result: GeneratedResult) => {
    setProcessingItems((prev) => new Set(prev).add(result.id))

    try {
      const response = await fetch("/api/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: result.src }),
      })

      const data = await response.json()

      if (data.success && data.image) {
        const newResult: GeneratedResult = {
          id: `nobg-${Date.now()}`,
          src: data.image,
          createdAt: Date.now(),
        }
        setResults((prev) => [newResult, ...prev])
      }
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev)
        next.delete(result.id)
        return next
      })
    }
  }, [])

  const handleDeleteResult = useCallback((id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const handleToggleFavorite = useCallback((id: string) => {
    setResults((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
      )
    )
  }, [])

  return (
    <div className="h-screen flex flex-col bg-sand-50 dark:bg-[#1a1918]">
      <TopBar />

      {/* Hidden file input for room upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleRoomUpload(file)
          e.target.value = ""
        }}
      />

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 overflow-hidden pt-14">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col p-4 gap-4">
          {/* Room Image Viewer */}
          <div className="flex-1 relative min-h-0">
            {baseImage ? (
              <RoomImageViewer
                image={baseImage}
                markers={markers}
                references={references}
                activeReferenceForPlacement={activeReferenceForPlacement}
                onAddPin={handleAddPin}
                onRemoveMarker={handleRemoveMarker}
                onCancelPlacement={() => setActiveReferenceForPlacement(null)}
                onChangeImage={() => fileInputRef.current?.click()}
                isSelectionMode={isSelectionMode}
                hasSelection={hasSelection}
                onSelectionModeToggle={handleSelectionModeToggle}
                onSelectionChange={handleSelectionChange}
                onClearSelection={handleClearSelection}
              />
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation() }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const file = e.dataTransfer.files?.[0]
                  if (file && file.type.startsWith("image/")) handleRoomUpload(file)
                }}
                className="h-full flex flex-col items-center justify-center border-2 border-dashed border-sand-300 dark:border-sand-500/30 rounded-2xl cursor-pointer hover:border-terracotta dark:hover:border-terracotta/70 hover:bg-sand-100/50 dark:hover:bg-sand-500/5 transition-all duration-300 group bg-white dark:bg-[#222120]"
              >
                <div className="flex flex-col items-center gap-5 text-sand-500 dark:text-sand-400">
                  <div className="w-24 h-24 rounded-2xl bg-sand-100 dark:bg-sand-500/10 flex items-center justify-center group-hover:scale-105 group-hover:bg-terracotta/10 transition-all duration-300">
                    <Upload className="w-10 h-10 group-hover:text-terracotta transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-display font-medium text-charcoal dark:text-sand-100">
                      Upload your image
                    </p>
                    <p className="text-sm text-sand-500 dark:text-sand-400 mt-1">
                      Drag & drop or click to browse
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Inline Questions */}
          {pendingQuestions && pendingQuestions.length > 0 && (
            <InlineQuestions
              questions={pendingQuestions}
              onComplete={handleQuestionAnswers}
              onSkip={handleSkipQuestions}
            />
          )}

          {/* Prompt Input */}
          <PromptInput
            prompt={prompt}
            setPrompt={setPrompt}
            settings={settings}
            setSettings={setSettings}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            isAnalyzing={isAnalyzing}
            canGenerate={canGenerate}
            generationMode={generationMode}
          />
        </div>

        {/* Right Sidebar - Desktop */}
        <div className="w-[340px] border-l border-sand-200 dark:border-sand-500/20 flex flex-col bg-white dark:bg-[#1f1e1d]">
          <ReferencePanel
            references={references}
            markers={markers}
            activeReferenceForPlacement={activeReferenceForPlacement}
            onAddReference={handleAddReference}
            onRemoveReference={handleRemoveReference}
            onStartPlacement={setActiveReferenceForPlacement}
            onCancelPlacement={() => setActiveReferenceForPlacement(null)}
            disabled={!baseImage}
          />
          <div className="h-px bg-sand-200 dark:bg-sand-500/20" />
          <ResultsGallery
            results={results}
            processingItems={processingItems}
            isGenerating={isGenerating}
            onDownload={handleDownload}
            onUpscale={handleUpscale}
            onUseAsBase={handleUseAsBase}
            onDelete={handleDeleteResult}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden pt-12">
        {/* Room Image Viewer - Mobile */}
        <div className="flex-1 min-h-0 p-3">
          {baseImage ? (
            <RoomImageViewer
              image={baseImage}
              markers={markers}
              references={references}
              activeReferenceForPlacement={activeReferenceForPlacement}
              onAddPin={handleAddPin}
              onRemoveMarker={handleRemoveMarker}
              onCancelPlacement={() => setActiveReferenceForPlacement(null)}
              onChangeImage={() => fileInputRef.current?.click()}
              isSelectionMode={isSelectionMode}
              hasSelection={hasSelection}
              onSelectionModeToggle={handleSelectionModeToggle}
              onSelectionChange={handleSelectionChange}
              onClearSelection={handleClearSelection}
            />
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="h-full flex flex-col items-center justify-center border-2 border-dashed border-sand-300 dark:border-sand-500/30 rounded-xl cursor-pointer active:border-terracotta dark:active:border-terracotta/70 active:bg-sand-100/50 dark:active:bg-sand-500/5 transition-all bg-white dark:bg-[#222120]"
            >
              <div className="flex flex-col items-center gap-3 text-sand-500 dark:text-sand-400 px-4">
                <div className="w-16 h-16 rounded-xl bg-sand-100 dark:bg-sand-500/10 flex items-center justify-center">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <p className="text-base font-display font-medium text-charcoal dark:text-sand-100">
                    Upload your image
                  </p>
                  <p className="text-xs text-sand-500 dark:text-sand-400 mt-0.5">
                    Tap to browse
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Tab Bar */}
        <div className="flex border-t border-sand-200 dark:border-sand-500/20 bg-white dark:bg-[#1f1e1d]">
          <button
            onClick={() => setMobileTab("references")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              mobileTab === "references"
                ? "text-terracotta border-b-2 border-terracotta"
                : "text-sand-500 dark:text-sand-400"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>References</span>
            {references.length > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-terracotta/10 text-terracotta text-xs flex items-center justify-center">
                {references.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileTab("results")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              mobileTab === "results"
                ? "text-terracotta border-b-2 border-terracotta"
                : "text-sand-500 dark:text-sand-400"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Results</span>
            {results.length > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-terracotta/10 text-terracotta text-xs flex items-center justify-center">
                {results.length}
              </span>
            )}
          </button>
        </div>

        {/* Mobile Tab Content - height for 2 rows of squares */}
        <div className="overflow-hidden bg-white dark:bg-[#1f1e1d]">
          {mobileTab === "references" ? (
            <ReferencePanel
              references={references}
              markers={markers}
              activeReferenceForPlacement={activeReferenceForPlacement}
              onAddReference={handleAddReference}
              onRemoveReference={handleRemoveReference}
              onStartPlacement={setActiveReferenceForPlacement}
              onCancelPlacement={() => setActiveReferenceForPlacement(null)}
              disabled={!baseImage}
              compact
            />
          ) : (
            <ResultsGallery
              results={results}
              processingItems={processingItems}
              isGenerating={isGenerating}
              onDownload={handleDownload}
              onUpscale={handleUpscale}
              onUseAsBase={handleUseAsBase}
              onDelete={handleDeleteResult}
              onToggleFavorite={handleToggleFavorite}
              compact
            />
          )}
        </div>

        {/* Inline Questions - Mobile */}
        {pendingQuestions && pendingQuestions.length > 0 && (
          <InlineQuestions
            questions={pendingQuestions}
            onComplete={handleQuestionAnswers}
            onSkip={handleSkipQuestions}
          />
        )}

        {/* Prompt Input - Mobile */}
        <div className="border-t border-sand-200 dark:border-sand-500/20 bg-white dark:bg-[#1f1e1d]">
          <PromptInput
            prompt={prompt}
            setPrompt={setPrompt}
            settings={settings}
            setSettings={setSettings}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            isAnalyzing={isAnalyzing}
            canGenerate={canGenerate}
            generationMode={generationMode}
            compact
          />
        </div>
      </div>
    </div>
  )
}
