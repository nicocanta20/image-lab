"use client"

import { useRef, useState, useEffect } from "react"
import { MAX_REFERENCES, type Marker, type ReferenceImage } from "./SimpleRoomDesigner"
import { FurnitureCatalog } from "./FurnitureCatalog"
import { Plus, MoreHorizontal, Trash2, X, AtSign } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ReferencePanelProps {
  references: ReferenceImage[]
  markers: Marker[]
  activeReferenceForPlacement: number | null
  onAddReference: (src: string, name?: string) => void
  onRemoveReference: (id: string) => void
  onStartPlacement: (refNumber: number) => void
  onCancelPlacement: () => void
  disabled: boolean
  compact?: boolean
}

export function ReferencePanel({
  references,
  markers,
  activeReferenceForPlacement,
  onAddReference,
  onRemoveReference,
  onStartPlacement,
  onCancelPlacement,
  disabled,
  compact = false,
}: ReferencePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch from Radix UI generating different IDs on server vs client
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      onAddReference(dataUrl, file.name)
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleCatalogSelect = (src: string, name: string) => {
    onAddReference(src, name)
    setCatalogOpen(false)
  }

  const getMarkersForRef = (refNumber: number) => {
    return markers.filter((m) => m.referenceNumber === refNumber)
  }

  const canAddMore = references.length < MAX_REFERENCES

  // Mobile compact layout - 4 columns grid
  if (compact) {
    return (
      <div className="flex flex-col p-2">
        <div className="grid grid-cols-4 gap-1.5">
            {references.map((ref) => {
              const refMarkers = getMarkersForRef(ref.referenceNumber)
              const isActive = activeReferenceForPlacement === ref.referenceNumber
              const hasPlacement = refMarkers.length > 0

              return (
                <div
                  key={ref.id}
                  className={`
                    relative aspect-square rounded-lg overflow-hidden
                    ${isActive ? "ring-2 ring-terracotta" : ""}
                  `}
                >
                  <img
                    src={ref.src}
                    alt={ref.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Number badge */}
                  <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-terracotta text-white text-xs font-semibold flex items-center justify-center">
                    {ref.referenceNumber}
                  </div>
                  {/* Actions overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 flex gap-1">
                    {isActive ? (
                      <button
                        onClick={onCancelPlacement}
                        className="flex-1 py-1 rounded bg-white/30 text-white text-[10px] font-medium"
                      >
                        Cancel
                      </button>
                    ) : hasPlacement ? (
                      <button
                        onClick={() => onStartPlacement(ref.referenceNumber)}
                        className="flex-1 py-1 rounded bg-white/30 text-white text-[10px] font-medium flex items-center justify-center gap-0.5"
                      >
                        <span>Placed</span>
                        <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartPlacement(ref.referenceNumber)}
                        className="flex-1 py-1 rounded bg-white/20 text-white text-[10px] font-medium"
                      >
                        Place
                      </button>
                    )}
                    <button
                      onClick={() => onRemoveReference(ref.id)}
                      className="p-1 rounded bg-white/20 text-white"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Add button */}
            {canAddMore && (
              <button
                disabled={disabled}
                onClick={() => !disabled && setCatalogOpen(true)}
                className={`
                  aspect-square rounded-lg border-2 border-dashed
                  flex flex-col items-center justify-center
                  transition-colors
                  ${disabled
                    ? "border-sand-200 dark:border-sand-600 text-sand-300 dark:text-sand-600"
                    : "border-sand-300 dark:border-sand-500/30 text-sand-400 active:border-terracotta active:text-terracotta"
                  }
                `}
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Mobile Catalog Modal */}
        {catalogOpen && (
          <div
            className="fixed inset-0 z-50 bg-charcoal/90 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setCatalogOpen(false)}
          >
            <div
              className="w-full max-h-[85vh] bg-white dark:bg-[#1f1e1d] rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setCatalogOpen(false)}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-sand-100 dark:bg-sand-500/20 flex items-center justify-center text-sand-500"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Catalog Content */}
              <FurnitureCatalog
                onSelect={handleCatalogSelect}
                onUploadClick={() => {
                  setCatalogOpen(false)
                  fileInputRef.current?.click()
                }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Desktop layout - vertical list
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-sand-200/60 dark:border-sand-500/10">
        <span className="text-xs font-medium tracking-wide uppercase text-sand-500 dark:text-sand-400">
          References
        </span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sand-100 dark:bg-sand-500/10 text-sand-500 dark:text-sand-400">
          {references.length}/{MAX_REFERENCES}
        </span>
      </div>

      {/* References List */}
      <div className="px-3 py-2 space-y-1">
        {references.map((ref) => {
          const refMarkers = getMarkersForRef(ref.referenceNumber)
          const isActive = activeReferenceForPlacement === ref.referenceNumber
          const hasPlacement = refMarkers.length > 0

          return (
            <div
              key={ref.id}
              className={`
                group flex items-center gap-2 px-2 py-1.5 rounded-lg
                transition-all duration-150
                ${isActive
                  ? "bg-terracotta/10 dark:bg-terracotta/15"
                  : "hover:bg-sand-100 dark:hover:bg-sand-500/10"
                }
              `}
            >
              {/* Tiny thumbnail with number overlay */}
              <div className="relative w-8 h-8 rounded-md overflow-hidden flex-shrink-0 bg-sand-100 dark:bg-sand-500/10">
                <img
                  src={ref.src}
                  alt={ref.name}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0 flex items-center justify-center bg-charcoal/40 text-white text-xs font-semibold"
                >
                  {ref.referenceNumber}
                </div>
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-charcoal dark:text-sand-100 truncate">
                  {ref.name}
                </p>
              </div>

              {/* Status dot with tooltip */}
              <div className="relative group/dot flex-shrink-0">
                <div
                  className={`
                    w-2 h-2 rounded-full transition-colors
                    ${isActive
                      ? "bg-terracotta animate-pulse"
                      : hasPlacement
                        ? "bg-terracotta"
                        : "bg-sand-300 dark:bg-sand-600"
                    }
                  `}
                />
                <div className="
                  absolute right-0 bottom-full mb-1 px-2 py-1
                  bg-charcoal dark:bg-sand-100 text-white dark:text-charcoal
                  text-[10px] rounded shadow-lg whitespace-nowrap
                  opacity-0 group-hover/dot:opacity-100 pointer-events-none
                  transition-opacity duration-150 z-10
                ">
                  {isActive ? "Placing..." : hasPlacement ? "Placed" : "Not placed"}
                </div>
              </div>

              {/* Actions: @ for Place, ⋮ for Remove */}
              <div className="flex items-center gap-0.5">
                {/* @ Place button */}
                {isActive ? (
                  <button
                    onClick={onCancelPlacement}
                    className="p-1 rounded bg-terracotta/10 text-terracotta hover:bg-terracotta/20 transition-colors"
                    title="Cancel placement"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => onStartPlacement(ref.referenceNumber)}
                    className="
                      p-1 rounded text-sand-400
                      hover:text-terracotta hover:bg-terracotta/10
                      transition-all duration-150
                    "
                    title="Place on image"
                  >
                    <AtSign className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* ⋮ Menu for Remove only */}
                {mounted ? (
                  <Popover
                    open={openMenuId === ref.id}
                    onOpenChange={(open) => setOpenMenuId(open ? ref.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        className="
                          p-1 rounded text-sand-400
                          opacity-0 group-hover:opacity-100
                          hover:text-charcoal dark:hover:text-sand-100
                          hover:bg-sand-200 dark:hover:bg-sand-500/20
                          transition-all duration-150
                        "
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="left"
                      align="start"
                      sideOffset={4}
                      className="w-28 p-1 border-sand-200 dark:border-sand-500/30 bg-white dark:bg-[#1f1e1d] shadow-lg"
                    >
                      <button
                        onClick={() => {
                          onRemoveReference(ref.id)
                          setOpenMenuId(null)
                        }}
                        className="
                          w-full flex items-center gap-2 px-2.5 py-1.5 rounded
                          text-xs text-red-600 dark:text-red-400
                          hover:bg-red-50 dark:hover:bg-red-500/10
                          transition-colors
                        "
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <button className="p-1 rounded text-sand-400 opacity-0">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Add Button - compact */}
        {canAddMore && mounted && (
          <Popover open={catalogOpen} onOpenChange={setCatalogOpen}>
            <PopoverTrigger asChild>
              <button
                disabled={disabled}
                className={`
                  w-full flex items-center justify-center gap-1.5 py-2 rounded-lg
                  text-xs font-medium transition-all duration-150
                  ${disabled
                    ? "text-sand-300 dark:text-sand-600 cursor-not-allowed"
                    : "text-sand-500 dark:text-sand-400 hover:text-terracotta dark:hover:text-terracotta hover:bg-terracotta/5"
                  }
                `}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="left"
              align="center"
              sideOffset={12}
              className="w-[300px] p-0 border-sand-200 dark:border-sand-500/30 bg-white dark:bg-[#1f1e1d] shadow-xl"
            >
              <FurnitureCatalog
                onSelect={handleCatalogSelect}
                onUploadClick={() => {
                  setCatalogOpen(false)
                  fileInputRef.current?.click()
                }}
              />
            </PopoverContent>
          </Popover>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* Helper when disabled */}
      {disabled && references.length === 0 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-sand-400 dark:text-sand-500 text-center">
            Upload a room first
          </p>
        </div>
      )}
    </div>
  )
}
