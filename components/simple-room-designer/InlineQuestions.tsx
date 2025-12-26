"use client"

import { useState, useEffect } from "react"
import { Check, CornerDownLeft } from "lucide-react"

export type Question = {
  id: string
  question: string
  header?: string
  options: { label: string; value: string; naturalPhrase?: string }[]
  allowCustom?: boolean
  multiSelect?: boolean
}

interface InlineQuestionsProps {
  questions: Question[]
  onComplete: (answers: Record<string, string | string[]>) => void
  onSkip: () => void
}

export function InlineQuestions({
  questions,
  onComplete,
  onSkip,
}: InlineQuestionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})
  const [showCustom, setShowCustom] = useState<Record<string, boolean>>({})
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const totalQuestions = questions.length

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Handle single select - store the human-readable label for use in prompts
  const handleOptionClick = (label: string) => {
    if (!currentQuestion) return

    if (currentQuestion.multiSelect) {
      // Multi-select: toggle the label
      const currentAnswers = (answers[currentQuestion.id] as string[]) || []
      const newAnswers = currentAnswers.includes(label)
        ? currentAnswers.filter((v) => v !== label)
        : [...currentAnswers, label]
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: newAnswers }))
      setShowCustom((prev) => ({ ...prev, [currentQuestion.id]: false }))
    } else {
      // Single select: set and advance
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: label }))
      setShowCustom((prev) => ({ ...prev, [currentQuestion.id]: false }))
      advanceOrComplete(label)
    }
  }

  // Handle custom input
  const handleCustomClick = () => {
    if (!currentQuestion) return
    setShowCustom((prev) => ({ ...prev, [currentQuestion.id]: true }))
  }

  const handleCustomSubmit = () => {
    if (!currentQuestion) return
    const customValue = customInputs[currentQuestion.id]?.trim()
    if (!customValue) return

    if (currentQuestion.multiSelect) {
      const currentAnswers = (answers[currentQuestion.id] as string[]) || []
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: [...currentAnswers, customValue],
      }))
    } else {
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: customValue }))
      advanceOrComplete(customValue)
    }
    setShowCustom((prev) => ({ ...prev, [currentQuestion.id]: false }))
    setCustomInputs((prev) => ({ ...prev, [currentQuestion.id]: "" }))
  }

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleCustomSubmit()
    } else if (e.key === "Escape") {
      setShowCustom((prev) => ({ ...prev, [currentQuestion.id]: false }))
    }
  }

  // For multi-select, need a "Done" button
  const handleMultiSelectDone = () => {
    const currentAnswers = answers[currentQuestion.id]
    if (currentAnswers && (currentAnswers as string[]).length > 0) {
      advanceOrComplete(currentAnswers)
    }
  }

  const advanceOrComplete = (value: string | string[]) => {
    if (isLastQuestion) {
      // Complete - exit animation then callback
      setIsExiting(true)
      setTimeout(() => {
        onComplete({ ...answers, [currentQuestion.id]: value })
      }, 200)
    } else {
      // Advance to next question
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handleSkip = () => {
    setIsExiting(true)
    setTimeout(() => onSkip(), 200)
  }

  if (!currentQuestion) return null

  const selectedValues = currentQuestion.multiSelect
    ? ((answers[currentQuestion.id] as string[]) || [])
    : [answers[currentQuestion.id] as string]

  return (
    <div
      className={`
        overflow-hidden transition-all duration-300 ease-out
        ${isVisible && !isExiting ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}
      `}
    >
      <div className="pb-3">
        <div className="bg-sand-50 dark:bg-[#252423] border border-sand-200/60 dark:border-sand-500/20 rounded-xl p-4">
          {/* Header row: tag + skip */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2.5">
              {currentQuestion.header && (
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-terracotta/10 text-terracotta rounded">
                  {currentQuestion.header}
                </span>
              )}
              {totalQuestions > 1 && (
                <div className="flex items-center gap-1">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className={`
                        w-1.5 h-1.5 rounded-full transition-all duration-300
                        ${i === currentIndex
                          ? "bg-terracotta w-3"
                          : i < currentIndex
                            ? "bg-terracotta/40"
                            : "bg-sand-300 dark:bg-sand-600"
                        }
                      `}
                    />
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleSkip}
              className="text-[11px] text-sand-400 hover:text-sand-600 dark:hover:text-sand-300 transition-colors"
            >
              skip
            </button>
          </div>

          {/* Question text */}
          <p className="text-sm text-charcoal dark:text-sand-100 mb-3 leading-relaxed">
            {currentQuestion.question}
          </p>

          {/* Options */}
          <div className="flex flex-wrap items-center gap-2">
            {currentQuestion.options.map((option, i) => {
              const isSelected = selectedValues.includes(option.label)
              return (
                <button
                  key={option.value}
                  onClick={() => handleOptionClick(option.label)}
                  className={`
                    group relative px-3.5 py-1.5 rounded-lg text-sm font-medium
                    transition-all duration-200 ease-out
                    ${isSelected
                      ? "bg-terracotta text-white shadow-sm"
                      : "bg-white dark:bg-[#1f1e1d] text-charcoal dark:text-sand-200 border border-sand-200 dark:border-sand-500/30 hover:border-terracotta/50 hover:bg-terracotta/5"
                    }
                  `}
                  style={{
                    animationDelay: `${i * 50}ms`,
                  }}
                >
                  {currentQuestion.multiSelect && isSelected && (
                    <Check className="w-3 h-3 inline mr-1.5 -ml-0.5" />
                  )}
                  {option.label}
                </button>
              )
            })}

            {/* Custom/Other option */}
            {currentQuestion.allowCustom !== false && !showCustom[currentQuestion.id] && (
              <button
                onClick={handleCustomClick}
                className="px-3.5 py-1.5 rounded-lg text-sm text-sand-400 dark:text-sand-500 border border-dashed border-sand-300 dark:border-sand-600 hover:border-sand-400 dark:hover:border-sand-500 hover:text-sand-500 dark:hover:text-sand-400 transition-all"
              >
                other...
              </button>
            )}

            {/* Custom input field */}
            {showCustom[currentQuestion.id] && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                <input
                  type="text"
                  value={customInputs[currentQuestion.id] || ""}
                  onChange={(e) =>
                    setCustomInputs((prev) => ({
                      ...prev,
                      [currentQuestion.id]: e.target.value,
                    }))
                  }
                  onKeyDown={handleCustomKeyDown}
                  placeholder="type here..."
                  autoFocus
                  className="px-3 py-1.5 w-36 rounded-lg text-sm bg-white dark:bg-[#1f1e1d] border border-sand-200 dark:border-sand-500/30 text-charcoal dark:text-sand-100 placeholder:text-sand-400 focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta/20"
                />
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customInputs[currentQuestion.id]?.trim()}
                  className="p-1.5 rounded-lg bg-terracotta text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-terracotta/90 transition-colors"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Multi-select done button */}
            {currentQuestion.multiSelect && selectedValues.length > 0 && (
              <button
                onClick={handleMultiSelectDone}
                className="ml-auto px-4 py-1.5 rounded-lg text-sm font-medium bg-charcoal dark:bg-sand-100 text-white dark:text-charcoal hover:opacity-90 transition-opacity"
              >
                done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
