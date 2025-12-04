"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, X, Loader2, Check, AlertCircle, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type QueueJobStatus = "pending" | "processing" | "completed" | "failed"

export type QueueJob = {
  id: string
  name: string
  status: QueueJobStatus
  progress?: number
  startedAt?: number
  completedAt?: number
  error?: string
  result?: string // Base64 image data
}

type GenerationQueueProps = {
  jobs: QueueJob[]
  onCancelJob: (id: string) => void
  onClearCompleted: () => void
  onClearAll: () => void
  onJobClick?: (job: QueueJob) => void
}

export function GenerationQueue({ jobs, onCancelJob, onClearCompleted, onClearAll, onJobClick }: GenerationQueueProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const activeJobs = jobs.filter((j) => j.status === "pending" || j.status === "processing")
  const completedJobs = jobs.filter((j) => j.status === "completed" || j.status === "failed")

  if (jobs.length === 0) return null

  const getElapsedTime = (job: QueueJob) => {
    if (!job.startedAt) return null
    const elapsed = (job.completedAt || Date.now()) - job.startedAt
    const seconds = Math.floor(elapsed / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const getStatusIcon = (status: QueueJobStatus) => {
    switch (status) {
      case "pending":
        return (
          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
        )
      case "processing":
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />
      case "completed":
        return <Check className="w-4 h-4 text-green-500" />
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />
    }
  }

  return (
    <div className="absolute bottom-4 right-4 z-50">
      <div className="rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-2xl min-w-[280px] max-w-[320px]">
        {/* Header - Always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Queue</span>
            <span className="text-sm text-muted-foreground">
              {activeJobs.length > 0 ? `${activeJobs.length} active` : `${completedJobs.length} done`}
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-border">
            {/* Actions */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground">{jobs.length} total</span>
              <div className="flex items-center gap-1">
                {completedJobs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearCompleted}
                    className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                  >
                    Clear done
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearAll}
                  className="h-6 text-xs px-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Job list */}
            <div className="max-h-[300px] overflow-y-auto">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-b-0",
                    "hover:bg-muted/20 transition-colors",
                    job.status === "completed" && onJobClick && "cursor-pointer",
                  )}
                  onClick={() => job.status === "completed" && onJobClick?.(job)}
                >
                  {/* Status icon */}
                  {getStatusIcon(job.status)}

                  {/* Job info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{job.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {job.status === "processing" && "Generating..."}
                      {job.status === "pending" && "Waiting..."}
                      {job.status === "completed" && getElapsedTime(job)}
                      {job.status === "failed" && (
                        <span className="text-red-500 truncate">{job.error || "Failed"}</span>
                      )}
                    </div>
                  </div>

                  {/* Cancel button for active jobs */}
                  {(job.status === "pending" || job.status === "processing") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onCancelJob(job.id)
                      }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Thumbnail for completed */}
                  {job.status === "completed" && job.result && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-border flex-shrink-0">
                      <img src={job.result || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
