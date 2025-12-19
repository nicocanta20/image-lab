"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  MousePointer2,
  Hand,
  Package,
  Plus,
  Armchair,
  Sofa,
  Lamp,
  Table,
  MonitorSmartphone,
  Bed,
} from "lucide-react"
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

export type Tool = "select" | "hand" | "catalog"

type LeftToolbarProps = {
  onSelectItem: (item: FurnitureItem) => void
  activeTool: Tool
  onToolChange: (tool: Tool) => void
  onUpload: () => void
}

// Main toolbar items
const tools = [
  { id: "select" as Tool, icon: MousePointer2, label: "Select", shortcut: "V" },
  { id: "hand" as Tool, icon: Hand, label: "Hand tool", shortcut: "H" },
  { id: "catalog" as Tool, icon: Package, label: "Catalog", shortcut: "C" },
]

export function LeftToolbar({
  onSelectItem,
  activeTool,
  onToolChange,
  onUpload,
}: LeftToolbarProps) {
  const [activeCategory, setActiveCategory] = useState("chairs")
  const filteredItems = furnitureItems.filter((item) => item.category === activeCategory)

  const showPanel = activeTool === "catalog"

  return (
    <>
      {/* Main Toolbar - always centered, independent */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1 p-1.5 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-lg">
        {tools.map((tool) => {
          const Icon = tool.icon
          const isActive = activeTool === tool.id
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(isActive && tool.id === "catalog" ? "select" : tool.id)}
              className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-lg transition-all",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}

        {/* Divider */}
        <div className="h-px bg-border my-1" />

        {/* Upload Button */}
        <button
          onClick={onUpload}
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-all text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Upload Image"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Expandable Panel - Catalog */}
      {showPanel && (
        <div className="absolute left-[72px] top-1/2 -translate-y-1/2 z-40 w-64 max-h-[400px] rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-lg overflow-hidden flex flex-col">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1 p-2 border-b border-border">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                    activeCategory === category.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={category.name}
                >
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
          </div>

          {/* Items Grid - scrollable */}
          <div className="p-2 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="group flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border bg-background/50 hover:border-primary hover:bg-accent transition-all"
                >
                  <div className="w-full aspect-square rounded-lg bg-muted overflow-hidden">
                    <img
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <span className="text-[10px] font-medium text-foreground text-center leading-tight">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
