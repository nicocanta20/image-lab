"use client"

import { Sparkles, ImageIcon, Settings2, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"

type PromptBarProps = {
  prompt: string
  onPromptChange: (value: string) => void
  onGenerate: () => void
  isGenerating: boolean
  disabled: boolean
}

export function PromptBar({ prompt, onPromptChange, onGenerate, isGenerating, disabled }: PromptBarProps) {
  return (
    <div className="p-4">
      <div className="max-w-3xl mx-auto">
        <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe what you want to create or change..."
            className="w-full min-h-[80px] p-4 pb-14 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
            disabled={disabled}
          />

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-3 border-t border-border/50">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">
                <ImageIcon className="w-4 h-4" />
                <span>Image</span>
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">
                <span>16:9</span>
              </button>
              <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <Settings2 className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <Shuffle className="w-4 h-4" />
              </button>
            </div>

            <Button onClick={onGenerate} disabled={disabled || isGenerating} className="gap-2">
              <Sparkles className="w-4 h-4" />
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
          </div>
        </div>

        {disabled && (
          <p className="text-center text-sm text-muted-foreground mt-2">Upload an image to get started</p>
        )}
      </div>
    </div>
  )
}
