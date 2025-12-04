"use client"

import { X, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

type GeneratedPreviewProps = {
  image: string
  onClose: () => void
}

export function GeneratedPreview({ image, onClose }: GeneratedPreviewProps) {
  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = image
    link.download = "generated-room.png"
    link.click()
  }

  return (
    <div className="rounded-2xl bg-card/90 backdrop-blur-md border border-border shadow-xl overflow-hidden max-w-lg">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="font-medium text-sm text-foreground">Generated Result</h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={handleDownload} className="h-7 px-2">
            <Download className="w-3.5 h-3.5 mr-1" />
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="p-2">
        <div className="relative rounded-xl overflow-hidden">
          <img
            src={image || "/placeholder.svg"}
            alt="Generated room design"
            className="w-full h-auto max-h-48 object-contain bg-muted"
          />
        </div>
      </div>
    </div>
  )
}
