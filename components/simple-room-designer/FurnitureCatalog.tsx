"use client"

import { useState } from "react"
import { Upload } from "lucide-react"

interface FurnitureCatalogProps {
  onSelect: (src: string, name: string) => void
  onUploadClick: () => void
}

const FURNITURE_ITEMS = [
  // Chairs
  { id: "chair-1", name: "Modern Chair", image: "/modern-minimalist-chair-white-background.jpg", category: "Seating" },
  { id: "chair-2", name: "Office Chair", image: "/ergonomic-office-chair-white-background.jpg", category: "Seating" },
  { id: "chair-3", name: "Dining Chair", image: "/wooden-dining-chair-white-background.jpg", category: "Seating" },
  // Sofas
  { id: "sofa-1", name: "L-Shape Sofa", image: "/l-shaped-sectional-sofa-white-background.jpg", category: "Seating" },
  { id: "sofa-2", name: "2-Seater Sofa", image: "/two-seater-modern-sofa-white-background.jpg", category: "Seating" },
  // Tables
  { id: "table-1", name: "Coffee Table", image: "/round-coffee-table-white-background.jpg", category: "Tables" },
  { id: "table-2", name: "Dining Table", image: "/wooden-dining-table-white-background.jpg", category: "Tables" },
  // Lamps
  { id: "lamp-1", name: "Floor Lamp", image: "/modern-floor-lamp-white-background.jpg", category: "Lighting" },
  { id: "lamp-2", name: "Table Lamp", image: "/table-lamp-white-background.jpg", category: "Lighting" },
  // Desks
  { id: "desk-1", name: "Work Desk", image: "/modern-work-desk-white-background.jpg", category: "Desks" },
  { id: "desk-2", name: "Standing Desk", image: "/standing-desk-white-background.jpg", category: "Desks" },
  // Beds
  { id: "bed-1", name: "King Bed", image: "/king-size-bed-white-background.jpg", category: "Beds" },
  { id: "bed-2", name: "Single Bed", image: "/single-bed-frame-white-background.jpg", category: "Beds" },
]

const CATEGORIES = ["All", "Seating", "Tables", "Lighting", "Desks", "Beds"]

export function FurnitureCatalog({
  onSelect,
  onUploadClick,
}: FurnitureCatalogProps) {
  const [activeCategory, setActiveCategory] = useState("All")

  const filteredItems = activeCategory === "All"
    ? FURNITURE_ITEMS
    : FURNITURE_ITEMS.filter(item => item.category === activeCategory)

  const handleSelect = (item: typeof FURNITURE_ITEMS[0]) => {
    onSelect(item.image, item.name)
  }

  return (
    <div className="flex flex-col max-h-[450px]">
      {/* Header */}
      <div className="p-4 border-b border-sand-200 dark:border-sand-500/20">
        <h3 className="font-display text-base font-semibold text-charcoal dark:text-sand-100">
          Reference catalog
        </h3>
        <p className="text-xs text-sand-500 dark:text-sand-400 mt-0.5">
          Select from catalog or upload custom
        </p>
      </div>

      {/* Upload Custom Button */}
      <div className="p-3 border-b border-sand-200 dark:border-sand-500/20">
        <button
          onClick={onUploadClick}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-sand-300 dark:border-sand-500/30 text-sand-600 dark:text-sand-400 hover:border-terracotta hover:text-terracotta dark:hover:border-terracotta/70 dark:hover:text-terracotta hover:bg-terracotta/5 transition-all"
        >
          <Upload className="w-4 h-4" />
          <span className="text-sm font-medium">Upload Custom Image</span>
        </button>
      </div>

      {/* Category Tabs - wrap to fit */}
      <div className="flex flex-wrap gap-1.5 p-3 border-b border-sand-200 dark:border-sand-500/20">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`
              px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors
              ${activeCategory === category
                ? "bg-terracotta text-white"
                : "bg-sand-100 dark:bg-sand-500/10 text-sand-600 dark:text-sand-400 hover:bg-sand-200 dark:hover:bg-sand-500/20"
              }
            `}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className="group flex flex-col items-center gap-2 p-2 rounded-xl border border-sand-200 dark:border-sand-500/20 bg-white dark:bg-sand-500/5 hover:border-terracotta dark:hover:border-terracotta/50 hover:bg-sand-50 dark:hover:bg-sand-500/10 transition-all"
            >
              <div className="w-full aspect-square rounded-lg bg-sand-50 dark:bg-sand-500/10 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <span className="text-xs font-medium text-charcoal dark:text-sand-200 text-center truncate w-full">
                {item.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
