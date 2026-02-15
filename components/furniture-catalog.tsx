"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Armchair, Sofa, Lamp, Table, MonitorSmartphone, Bed } from "lucide-react"
import type { FurnitureItem } from "./room-designer"

const categories = [
  { id: "chairs", name: "Chairs", icon: Armchair },
  { id: "sofas", name: "Sofas", icon: Sofa },
  { id: "tables", name: "Tables", icon: Table },
  { id: "lamps", name: "Lamps", icon: Lamp },
  { id: "desks", name: "Desks", icon: MonitorSmartphone },
  { id: "beds", name: "Beds", icon: Bed },
]

const furnitureItems: FurnitureItem[] = [
  { id: "chair-1", name: "Modern Chair", image: "/modern-minimalist-chair-white-background.jpg", category: "chairs" },
  { id: "chair-2", name: "Office Chair", image: "/ergonomic-office-chair-white-background.jpg", category: "chairs" },
  { id: "chair-3", name: "Dining Chair", image: "/wooden-dining-chair-white-background.jpg", category: "chairs" },
  { id: "sofa-1", name: "L-Shape Sofa", image: "/l-shaped-sectional-sofa-white-background.jpg", category: "sofas" },
  { id: "sofa-2", name: "2-Seater Sofa", image: "/two-seater-modern-sofa-white-background.jpg", category: "sofas" },
  { id: "table-1", name: "Coffee Table", image: "/round-coffee-table-white-background.jpg", category: "tables" },
  { id: "table-2", name: "Dining Table", image: "/wooden-dining-table-white-background.jpg", category: "tables" },
  { id: "lamp-1", name: "Floor Lamp", image: "/modern-floor-lamp-white-background.jpg", category: "lamps" },
  { id: "lamp-2", name: "Table Lamp", image: "/table-lamp-white-background.jpg", category: "lamps" },
  { id: "desk-1", name: "Work Desk", image: "/modern-work-desk-white-background.jpg", category: "desks" },
  { id: "desk-2", name: "Standing Desk", image: "/standing-desk-white-background.jpg", category: "desks" },
  { id: "bed-1", name: "King Bed", image: "/king-size-bed-white-background.jpg", category: "beds" },
  { id: "bed-2", name: "Single Bed", image: "/single-bed-frame-white-background.jpg", category: "beds" },
]

type FurnitureCatalogProps = {
  onSelect: (item: FurnitureItem) => void
}

export function FurnitureCatalog({ onSelect }: FurnitureCatalogProps) {
  const [activeCategory, setActiveCategory] = useState("chairs")

  const filteredItems = furnitureItems.filter((item) => item.category === activeCategory)

  return (
    <aside className="w-72 border-l border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Reference catalog</h2>
        <p className="text-sm text-muted-foreground mt-1">Click to add to canvas</p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-border">
        {categories.map((category) => {
          const Icon = category.icon
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                activeCategory === category.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{category.name}</span>
            </button>
          )
        })}
      </div>

      {/* Furniture Items Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-background hover:border-primary hover:bg-accent transition-colors"
            >
              <div className="w-full aspect-square rounded-lg bg-muted overflow-hidden">
                <img
                  src={item.image || "/placeholder.svg"}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <span className="text-xs font-medium text-foreground text-center">{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
