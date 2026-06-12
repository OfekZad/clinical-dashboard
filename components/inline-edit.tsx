"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Shared hook for Enter / Escape behaviour
// ---------------------------------------------------------------------------

function useInlineEdit(onSave: (value: string) => Promise<void>) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const startEditing = useCallback((currentValue: string) => {
    setInputValue(currentValue)
    setEditing(true)
  }, [])

  const cancel = useCallback(() => {
    setEditing(false)
    setInputValue("")
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await onSave(inputValue)
      setEditing(false)
      router.refresh()
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }, [inputValue, onSave, router])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        save()
      } else if (e.key === "Escape") {
        e.preventDefault()
        cancel()
      }
    },
    [save, cancel],
  )

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  return {
    editing,
    inputValue,
    setInputValue,
    saving,
    inputRef,
    startEditing,
    cancel,
    save,
    handleKeyDown,
  }
}

// ---------------------------------------------------------------------------
// InlineText – editable text field (name, email, phone, date of birth)
// ---------------------------------------------------------------------------

interface InlineTextProps {
  value: string | null
  onSave: (value: string) => Promise<void>
  className?: string
  placeholder?: string
  displayClassName?: string
}

export function InlineText({ value, onSave, className, placeholder, displayClassName }: InlineTextProps) {
  const { editing, inputValue, setInputValue, saving, inputRef, startEditing, cancel, save, handleKeyDown } =
    useInlineEdit(onSave)

  if (editing) {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={cancel}
          disabled={saving}
          className="h-7 w-auto min-w-[120px] text-sm"
          placeholder={placeholder}
        />
        {saving && <span className="text-xs text-muted-foreground">...</span>}
      </div>
    )
  }

  return (
    <span
      onClick={() => startEditing(value ?? "")}
      className={cn(
        "cursor-pointer rounded px-0.5 transition-colors hover:bg-accent/60 hover:ring-1 hover:ring-ring/30",
        displayClassName,
      )}
      title="Click to edit"
    >
      {value || placeholder || "—"}
    </span>
  )
}

// ---------------------------------------------------------------------------
// InlineNumber – editable integer (OSDI score, 0–100)
// ---------------------------------------------------------------------------

interface InlineNumberProps {
  value: number | null
  onSave: (value: string) => Promise<void>
  min?: number
  max?: number
  className?: string
  suffix?: string
}

export function InlineNumber({ value, onSave, min = 0, max = 100, className, suffix }: InlineNumberProps) {
  // Wrap onSave to clamp the value to the valid range
  const doSave = useCallback(async (val: string) => {
    const num = parseInt(val, 10)
    if (isNaN(num)) return
    const clamped = Math.max(min, Math.min(max, num))
    await onSave(String(clamped))
  }, [onSave, min, max])

  const { editing, inputValue, setInputValue, saving, inputRef, startEditing, cancel, handleKeyDown } =
    useInlineEdit(doSave)

  if (editing) {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        <Input
          ref={inputRef}
          type="number"
          min={min}
          max={max}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={cancel}
          disabled={saving}
          className="h-7 w-20 text-sm"
        />
        {saving && <span className="text-xs text-muted-foreground">...</span>}
      </div>
    )
  }

  return (
    <span
      onClick={() => startEditing(value !== null ? String(value) : "")}
      className={cn(
        "cursor-pointer rounded px-0.5 transition-colors hover:bg-accent/60 hover:ring-1 hover:ring-ring/30",
        className,
      )}
      title="Click to edit"
    >
      {value !== null ? value : "—"}
      {value !== null && suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </span>
  )
}

// ---------------------------------------------------------------------------
// InlineSelect – tag-style picker (severity, status)
// ---------------------------------------------------------------------------

interface InlineSelectProps {
  value: string | null
  options: { value: string; label: string; colorClass?: string }[]
  onSave: (value: string) => Promise<void>
  className?: string
  /** Renders the displayed value with a custom appearance */
  renderDisplay?: (value: string | null) => React.ReactNode
}

export function InlineSelect({ value, options, onSave, className, renderDisplay }: InlineSelectProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  // Click outside to cancel
  useEffect(() => {
    if (!editing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [editing])

  // Escape key to cancel
  useEffect(() => {
    if (!editing) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditing(false)
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [editing])

  const handleSelect = async (optionValue: string) => {
    setSaving(true)
    try {
      await onSave(optionValue)
      setEditing(false)
      router.refresh()
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div ref={containerRef} className={cn("relative inline-flex flex-wrap gap-1.5 p-1", className)}>
        {options.map((opt) => (
          <Badge
            key={opt.value}
            variant="outline"
            className={cn(
              "cursor-pointer transition-all hover:ring-1 hover:ring-ring/50",
              value === opt.value
                ? opt.colorClass || "bg-primary/10 text-primary border-primary/30"
                : "bg-accent/30 text-muted-foreground hover:bg-accent/60",
              saving && "pointer-events-none opacity-50",
            )}
            onClick={() => handleSelect(opt.value)}
          >
            {opt.label}
          </Badge>
        ))}
      </div>
    )
  }

  if (renderDisplay) {
    return (
      <span
        onClick={() => setEditing(true)}
        className={cn("cursor-pointer rounded transition-colors hover:bg-accent/60", className)}
        title="Click to edit"
      >
        {renderDisplay(value)}
      </span>
    )
  }

  const currentOption = options.find((o) => o.value === value)
  return (
    <span
      onClick={() => setEditing(true)}
      className={cn(
        "cursor-pointer rounded px-0.5 transition-colors hover:bg-accent/60 hover:ring-1 hover:ring-ring/30",
        className,
      )}
      title="Click to edit"
    >
      {currentOption?.label || value || "—"}
    </span>
  )
}

// ---------------------------------------------------------------------------
// InlineDate – date picker (last visit)
// ---------------------------------------------------------------------------

interface InlineDateProps {
  value: string | null
  onSave: (value: string) => Promise<void>
  className?: string
}

export function InlineDate({ value, onSave, className }: InlineDateProps) {
  const { editing, inputValue, setInputValue, saving, inputRef, startEditing, cancel, handleKeyDown } =
    useInlineEdit(onSave)

  if (editing) {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        <Input
          ref={inputRef}
          type="date"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={cancel}
          disabled={saving}
          className="h-7 w-auto text-sm"
        />
        {saving && <span className="text-xs text-muted-foreground">...</span>}
      </div>
    )
  }

  // Format for display
  const displayValue = value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—"

  return (
    <span
      onClick={() => startEditing(value ? value.slice(0, 10) : "")}
      className={cn(
        "cursor-pointer rounded px-0.5 transition-colors hover:bg-accent/60 hover:ring-1 hover:ring-ring/30",
        className,
      )}
      title="Click to edit"
    >
      {displayValue}
    </span>
  )
}