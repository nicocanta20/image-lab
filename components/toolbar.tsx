"use client"

import { Undo2, Redo2, Minus, Plus, Maximize2, Upload, MousePointer2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ToolbarProps = {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onUpload: () => void
  // Tool mode
  activeTool: "select" | "marker"
  onToolChange: (tool: "select" | "marker") => void
  // Undo/Redo - disabled for now
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
}

export function Toolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onUpload,
  activeTool,
  onToolChange,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: ToolbarProps) {
  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-40">
      <div className="flex flex-col items-center gap-1 bg-card/95 backdrop-blur-md border border-border rounded-2xl p-1.5 shadow-lg">
        {/* Tool Selection */}
        <div className="flex flex-col gap-0.5 pb-1.5 border-b border-border mb-1.5">
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-9 w-9 rounded-xl",
              activeTool === "select" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            )}
            onClick={() => onToolChange("select")}
            title="Select & Move (V)"
          >
            <MousePointer2 className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-9 w-9 rounded-xl",
              activeTool === "marker" && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            )}
            onClick={() => onToolChange("marker")}
            title="Place Marker (M)"
          >
            <MapPin className="w-4 h-4" />
          </Button>
        </div>

        {/* Undo/Redo */}
        <div className="flex flex-col gap-0.5 pb-1.5 border-b border-border mb-1.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Cmd+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Zoom Controls */}
        <div className="flex flex-col gap-0.5 pb-1.5 border-b border-border mb-1.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl"
            onClick={onZoomIn}
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <div className="h-9 w-9 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl"
            onClick={onZoomOut}
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl"
            onClick={onZoomReset}
            title="Fit to Screen"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Upload */}
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-xl"
          onClick={onUpload}
          title="Upload Image"
        >
          <Upload className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
