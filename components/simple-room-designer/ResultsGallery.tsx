"use client"

import { useState, useEffect, useCallback } from "react"
import type { GeneratedResult, GenerationContext, UpscaleMetadata } from "./SimpleRoomDesigner"
import {
  Download,
  ArrowUpFromLine,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Maximize2,
  X,
  ImagePlus,
  Heart,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

// Format snake_case or kebab-case strings to Title Case
function formatLabel(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

interface ResultsGalleryProps {
  results: GeneratedResult[]
  processingItems: Set<string>
  isGenerating?: boolean
  onDownload: (result: GeneratedResult) => void
  onUpscale: (result: GeneratedResult) => void
  onUseAsBase: (result: GeneratedResult) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  compact?: boolean
}

// Elegant loading placeholder with pulse animation
function LoadingPlaceholder({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div
      className={`
        relative overflow-hidden
        ${compact ? "aspect-square rounded-lg" : "aspect-square rounded-xl"}
        bg-sand-100/80 dark:bg-sand-500/10
      `}
    >
      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        {/* Spinning ring */}
        <div className="relative">
          <div className="w-8 h-8 rounded-full border-2 border-sand-200 dark:border-sand-600" />
          <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-transparent border-t-terracotta animate-spin" />
        </div>

        {/* Label */}
        {!compact && (
          <span className="text-[11px] font-medium text-sand-400 dark:text-sand-500">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

export function ResultsGallery({
  results,
  processingItems,
  isGenerating = false,
  onDownload,
  onUpscale,
  onUseAsBase,
  onDelete,
  onToggleFavorite,
  compact = false,
}: ResultsGalleryProps) {
  // Count how many upscales are in progress (to show placeholders)
  const upscaleCount = processingItems.size
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)

  // Derive selectedResult from results array so it stays in sync
  const selectedResult = selectedResultId
    ? results.find(r => r.id === selectedResultId) || null
    : null

  // Navigation for modal
  const selectedIndex = selectedResultId
    ? results.findIndex(r => r.id === selectedResultId)
    : -1
  const canGoPrev = selectedIndex > 0
  const canGoNext = selectedIndex < results.length - 1

  const goToPrev = () => {
    if (canGoPrev) {
      setSelectedResultId(results[selectedIndex - 1].id)
    }
  }

  const goToNext = () => {
    if (canGoNext) {
      setSelectedResultId(results[selectedIndex + 1].id)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    if (!selectedResultId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goToPrev()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        goToNext()
      } else if (e.key === "Escape") {
        setSelectedResultId(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedResultId, selectedIndex, results])

  // Mobile compact layout - 4 columns grid
  if (compact) {
    const hasAnyLoading = isGenerating || upscaleCount > 0
    const showEmptyState = results.length === 0 && !hasAnyLoading

    return (
      <div className="flex flex-col p-2">
        <div className="grid grid-cols-4 gap-1.5">
            {showEmptyState ? (
              <div className="col-span-4 flex items-center justify-center py-6 text-sand-400 dark:text-sand-500">
                <div className="flex flex-col items-center gap-1">
                  <ImageIcon className="w-5 h-5" />
                  <p className="text-[10px]">No results</p>
                </div>
              </div>
            ) : (
              <>
                {/* Generation placeholder */}
                {isGenerating && <LoadingPlaceholder label="Generating" compact />}

                {/* Upscale placeholders */}
                {Array.from({ length: upscaleCount }).map((_, i) => (
                  <LoadingPlaceholder key={`upscale-${i}`} label="Upscaling" compact />
                ))}

                {/* Actual results - skip items being processed since they have placeholders */}
                {results
                  .filter((r) => !processingItems.has(r.id))
                  .slice(0, 8 - (isGenerating ? 1 : 0) - upscaleCount)
                  .map((result) => (
                    <div
                      key={result.id}
                      className="relative aspect-square rounded-lg overflow-hidden bg-sand-100 dark:bg-sand-500/10"
                      onClick={() => setSelectedResultId(result.id)}
                    >
                      <img
                        src={result.src}
                        alt="Generated room"
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onUseAsBase(result)
                          }}
                          className="flex-1 py-1 rounded bg-terracotta/80 text-white text-[10px] font-medium"
                        >
                          Use
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDownload(result)
                          }}
                          className="p-1 rounded bg-white/20 text-white"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>

                      {result.isFavorite && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
                          <Heart className="w-3 h-3 text-red-500 fill-current" />
                        </div>
                      )}
                    </div>
                  ))}
              </>
            )}
          </div>

        {/* Detail Modal - Mobile optimized */}
        {selectedResult && (
          <div
            className="fixed inset-0 z-50 bg-charcoal/95 backdrop-blur-md flex flex-col"
            onClick={() => setSelectedResultId(null)}
          >
            {/* Header with counter and close */}
            <div className="flex-shrink-0 flex items-center justify-between p-3">
              {/* Image counter */}
              <div className="px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm font-medium">
                {selectedIndex + 1} / {results.length}
              </div>
              <button
                onClick={() => setSelectedResultId(null)}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image - takes available space */}
            <div
              className="flex-1 flex items-center justify-center p-4 min-h-0 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Prev arrow */}
              {canGoPrev && (
                <button
                  onClick={goToPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              <img
                src={selectedResult.src}
                alt="Generated room"
                className="max-w-full max-h-full object-contain rounded-lg"
              />

              {/* Next arrow */}
              {canGoNext && (
                <button
                  onClick={goToNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Actions - bottom sheet style */}
            <div
              className="flex-shrink-0 bg-[#1a1918] rounded-t-2xl p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  onUseAsBase(selectedResult)
                  setSelectedResultId(null)
                }}
                className="w-full py-3 rounded-xl bg-terracotta text-white text-sm font-medium flex items-center justify-center gap-2"
              >
                <ImagePlus className="w-4 h-4" />
                Use as Base
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => onDownload(selectedResult)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-sand-200 text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => {
                    onUpscale(selectedResult)
                    setSelectedResultId(null)
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-sand-200 text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <ArrowUpFromLine className="w-4 h-4" />
                  Upscale
                </button>
                <button
                  onClick={() => {
                    onDelete(selectedResult.id)
                    setSelectedResultId(null)
                  }}
                  className="py-2.5 px-4 rounded-xl bg-white/10 text-red-400 text-xs font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Desktop layout
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="font-display text-lg font-semibold text-charcoal dark:text-sand-100">
            Results
          </h2>
          <p className="text-xs text-sand-500 dark:text-sand-400 mt-0.5">
            {results.length > 0
              ? `${results.length} generation${results.length > 1 ? "s" : ""}`
              : "Generated designs appear here"}
          </p>
        </div>
      </div>

      {/* Results Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {results.length === 0 && !isGenerating && upscaleCount === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-sand-400 dark:text-sand-500">
            <div className="w-16 h-16 rounded-2xl bg-sand-100 dark:bg-sand-500/10 flex items-center justify-center mb-4">
              <ImageIcon className="w-7 h-7" />
            </div>
            <p className="text-sm text-center">No results yet</p>
            <p className="text-xs text-center mt-1 max-w-[200px]">
              Add furniture references and generate to see designs here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Generation placeholder */}
            {isGenerating && <LoadingPlaceholder label="Generating..." />}

            {/* Upscale placeholders */}
            {Array.from({ length: upscaleCount }).map((_, i) => (
              <LoadingPlaceholder key={`upscale-${i}`} label="Upscaling..." />
            ))}

            {/* Actual results - filter out items being processed */}
            {results
              .filter((r) => !processingItems.has(r.id))
              .map((result) => (
                <div
                  key={result.id}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-sand-100 dark:bg-sand-500/10 cursor-pointer"
                  onClick={() => setSelectedResultId(result.id)}
                >
                  <img
                    src={result.src}
                    alt="Generated room"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Hover overlay with quick actions */}
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onUseAsBase(result)
                        }}
                        className="w-8 h-8 rounded-lg bg-terracotta/80 hover:bg-terracotta backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                        title="Use as Base"
                      >
                        <ImagePlus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDownload(result)
                        }}
                        className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onUpscale(result)
                        }}
                        className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                        title="Upscale"
                      >
                        <ArrowUpFromLine className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(result.id)
                        }}
                        className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Timestamp badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-charcoal/60 backdrop-blur-sm text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity select-none">
                    {new Date(result.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>

                  {/* Favorite button - always visible when favorited */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(result.id)
                    }}
                    className={`
                      absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all
                      ${result.isFavorite
                        ? "bg-white/90 text-red-500"
                        : "bg-charcoal/40 text-white opacity-0 group-hover:opacity-100"
                      }
                    `}
                  >
                    <Heart className={`w-4 h-4 ${result.isFavorite ? "fill-current" : ""}`} />
                  </button>
                </div>
              ))}

          </div>
        )}
      </div>

      {/* Detail Modal with Context Panel */}
      {selectedResult && (
        <div
          className="fixed inset-0 z-50 bg-charcoal/90 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setSelectedResultId(null)}
        >
          <div
            className="relative w-full h-full max-w-[1100px] max-h-[650px] flex bg-[#1a1918] rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: Image */}
            <div className="flex-1 relative bg-[#111] flex items-center justify-center p-4">
              {/* Prev arrow */}
              {canGoPrev && (
                <button
                  onClick={goToPrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:bg-black/70 hover:text-white transition-colors z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              <img
                src={selectedResult.src}
                alt="Generated room"
                className="max-w-full max-h-full object-contain rounded"
              />

              {/* Next arrow */}
              {canGoNext && (
                <button
                  onClick={goToNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:bg-black/70 hover:text-white transition-colors z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}

              {/* Counter + Timestamp overlay */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <div className="px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded text-[11px] text-white/80 font-medium">
                  {selectedIndex + 1} / {results.length}
                </div>
                <div className="px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded text-[11px] text-white/60">
                {new Date(selectedResult.createdAt).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => setSelectedResultId(null)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Context Panel */}
            <div className="w-[320px] border-l border-white/10 flex flex-col bg-[#1a1918]">
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/10">
                <h3 className="text-sm font-medium text-sand-100">Details</h3>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedResult.context ? (
                  <>
                    {/* User Prompt */}
                    {selectedResult.context.prompt && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-sand-500">Request</span>
                        <p className="text-[13px] text-sand-200 leading-relaxed">
                          {selectedResult.context.prompt}
                        </p>
                      </div>
                    )}

                    {/* Room Context */}
                    {selectedResult.context.roomDescription && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-sand-500">Room</span>
                        <p className="text-[13px] text-sand-300 leading-relaxed">
                          {selectedResult.context.roomDescription}
                        </p>
                      </div>
                    )}

                    {/* References Used */}
                    {selectedResult.context.references && selectedResult.context.references.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-sand-500">References</span>
                        <div className="space-y-1">
                          {selectedResult.context.references.map((ref, i) => (
                            <div key={i} className="flex items-center gap-2 text-[13px] text-sand-300">
                              <span className="w-4 h-4 rounded bg-terracotta/20 text-terracotta text-[10px] flex items-center justify-center font-semibold">
                                {ref.referenceNumber}
                              </span>
                              <span>{ref.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Q&A Section */}
                    {selectedResult.context.questions && selectedResult.context.questions.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-sand-500">Clarifications</span>
                        <div className="space-y-2.5">
                          {selectedResult.context.questions.map((qa, i) => (
                            <div key={i} className="space-y-0.5">
                              <p className="text-[11px] text-sand-500">{qa.question}</p>
                              <p className="text-[13px] text-sand-100">
                                {Array.isArray(qa.answer)
                                  ? qa.answer.map(a => formatLabel(a)).join(", ")
                                  : formatLabel(qa.answer)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Settings */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-sand-500">Style</span>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 text-[11px] bg-white/5 text-sand-300 rounded">
                          {formatLabel(selectedResult.context.settings.style)}
                        </span>
                        <span className="px-2 py-0.5 text-[11px] bg-white/5 text-sand-300 rounded">
                          {formatLabel(selectedResult.context.settings.lighting)}
                        </span>
                      </div>
                    </div>
                  </>
                ) : selectedResult.upscaleInfo ? (
                  <>
                    {/* Upscale Badge */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full">
                        <Maximize2 className="w-3 h-3" />
                        <span className="text-[11px] font-medium">Upscaled {selectedResult.upscaleInfo.scaleFactor}×</span>
                      </div>
                    </div>

                    {/* Resolution Comparison */}
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-sand-500">Original</span>
                        <p className="text-[13px] text-sand-400">
                          {selectedResult.upscaleInfo.originalWidth} × {selectedResult.upscaleInfo.originalHeight} px
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-sand-500">
                        <div className="flex-1 h-px bg-white/10" />
                        <ArrowUpFromLine className="w-3 h-3" />
                        <div className="flex-1 h-px bg-white/10" />
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-sand-500">Upscaled</span>
                        <p className="text-[15px] font-medium text-sand-100">
                          {selectedResult.upscaleInfo.upscaledWidth} × {selectedResult.upscaleInfo.upscaledHeight} px
                        </p>
                      </div>
                    </div>

                    {/* Enhancement Info */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-sand-500">Enhancement</span>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 text-[11px] bg-white/5 text-sand-300 rounded">
                          AuraSR v2
                        </span>
                        <span className="px-2 py-0.5 text-[11px] bg-white/5 text-sand-300 rounded">
                          AI Enhanced
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-sand-500">
                    <p className="text-sm">No details available</p>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="p-3 border-t border-white/10 space-y-2">
                <button
                  onClick={() => {
                    onUseAsBase(selectedResult)
                    setSelectedResultId(null)
                  }}
                  className="w-full py-2 rounded-lg bg-terracotta hover:bg-terracotta/90 text-white text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Use as Base
                </button>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => onToggleFavorite(selectedResult.id)}
                    className={`flex-1 py-2 px-3 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      selectedResult.isFavorite
                        ? "bg-red-500/10 text-red-400"
                        : "bg-white/5 text-sand-400 hover:bg-white/10"
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 flex-shrink-0 ${selectedResult.isFavorite ? "fill-current" : ""}`} />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => onDownload(selectedResult)}
                    className="flex-1 py-2 px-3 rounded-lg bg-white/5 text-sand-400 hover:bg-white/10 text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => {
                      onUpscale(selectedResult)
                      setSelectedResultId(null)
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-white/5 text-sand-400 hover:bg-white/10 text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Upscale</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
