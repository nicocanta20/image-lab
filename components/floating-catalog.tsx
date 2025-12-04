"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Armchair, Sofa, Lamp, Table, MonitorSmartphone, Bed, ChevronLeft, ChevronRight } from "lucide-react"
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

type FloatingCatalogProps = {
  onSelect: (item: FurnitureItem) => void
}

export function FloatingCatalog({ onSelect }: FloatingCatalogProps) {
  const [activeCategory, setActiveCategory] = useState("chairs")
  const [isCollapsed, setIsCollapsed] = useState(false)

  const filteredItems = furnitureItems.filter((item) => item.category === activeCategory)

  return (
    <aside
      className={cn(
        "absolute left-4 top-1/2 -translate-y-1/2 z-40 flex transition-all duration-300",
        isCollapsed ? "w-12" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex flex-col rounded-2xl bg-card/90 backdrop-blur-md border border-border shadow-xl transition-all duration-300",
          isCollapsed ? "w-12 overflow-hidden" : "w-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          {!isCollapsed && (
            <div>
              <h2 className="font-semibold text-sm text-foreground">Furniture</h2>
              <p className="text-xs text-muted-foreground">Click to add</p>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Category Icons */}
        <div className={cn("flex border-b border-border", isCollapsed ? "flex-col p-2 gap-1" : "flex-wrap gap-1 p-2")}>
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "flex items-center justify-center rounded-lg transition-colors",
                  isCollapsed ? "w-8 h-8" : "w-8 h-8",
                  activeCategory === category.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                title={category.name}
              >
                <Icon className="w-4 h-4" />
              </button>
            )
          })}
        </div>

        {/* Items Grid */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto p-2 max-h-80">
            <div className="grid grid-cols-2 gap-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="group flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border bg-background/50 hover:border-primary hover:bg-accent transition-all"
                >
                  <div className="w-full aspect-square rounded-lg bg-muted overflow-hidden">
                    <img
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <span className="text-[10px] font-medium text-foreground text-center leading-tight">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
