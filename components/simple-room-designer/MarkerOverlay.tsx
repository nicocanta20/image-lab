"use client"

import type { Marker, ReferenceImage } from "./SimpleRoomDesigner"

interface MarkerOverlayProps {
  markers: Marker[]
  references: ReferenceImage[]
  onRemoveMarker: (id: string) => void
}

// Elegant thin X using CSS
function CloseIcon() {
  return (
    <span className="relative block" style={{ width: '8px', height: '8px' }}>
      <span
        className="absolute rotate-45"
        style={{
          width: '8px',
          height: '1.5px',
          top: '50%',
          left: '0',
          marginTop: '-0.75px',
          backgroundColor: 'currentColor',
          borderRadius: '1px',
        }}
      />
      <span
        className="absolute -rotate-45"
        style={{
          width: '8px',
          height: '1.5px',
          top: '50%',
          left: '0',
          marginTop: '-0.75px',
          backgroundColor: 'currentColor',
          borderRadius: '1px',
        }}
      />
    </span>
  )
}

export function MarkerOverlay({
  markers,
  references,
  onRemoveMarker,
}: MarkerOverlayProps) {
  return (
    <div className="absolute inset-0 overflow-visible select-none">
      {markers.map((marker) => {
        const ref = references.find(
          (r) => r.referenceNumber === marker.referenceNumber
        )
        const label = ref?.name || `Item ${marker.referenceNumber}`

        return (
          <div
            key={marker.id}
            className="absolute pointer-events-auto select-none"
            style={{
              left: `${marker.x}%`,
              top: `${marker.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="relative group select-none">
              {/* Pin circle - smaller on mobile */}
              <div
                className="
                  w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center
                  text-white font-semibold text-[10px] md:text-xs shadow-lg
                  transition-transform duration-200 hover:scale-110
                  select-none
                "
                style={{ backgroundColor: "#c4653a" }}
              >
                {marker.referenceNumber}
              </div>

              {/* Preview tooltip with image - hidden on mobile */}
              {ref && (
                <div
                  className="
                    hidden md:block
                    absolute left-10 top-1/2 -translate-y-1/2
                    p-1 bg-white dark:bg-[#1f1e1d]
                    rounded-lg shadow-xl
                    border border-sand-200/50 dark:border-sand-500/30
                    opacity-0 group-hover:opacity-100 transition-opacity duration-200
                    pointer-events-none select-none
                  "
                >
                  <div className="w-14 h-14 rounded-md overflow-hidden bg-sand-100 dark:bg-sand-500/10">
                    <img
                      src={ref.src}
                      alt={ref.name}
                      className="w-full h-full object-cover select-none"
                    />
                  </div>
                </div>
              )}

              {/* Remove button - smaller on mobile */}
              <button
                onClick={() => onRemoveMarker(marker.id)}
                className="
                  absolute -top-0.5 -right-0.5 w-3.5 h-3.5 md:w-4 md:h-4 rounded-full
                  bg-cream dark:bg-sand-200
                  text-terracotta dark:text-terracotta-dark
                  flex items-center justify-center
                  opacity-0 group-hover:opacity-100
                  md:transition-all md:duration-200 md:ease-out
                  hover:scale-110 hover:bg-sand-100 dark:hover:bg-sand-300
                  shadow-sm border border-sand-200/50 dark:border-sand-400/30
                  select-none
                "
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
