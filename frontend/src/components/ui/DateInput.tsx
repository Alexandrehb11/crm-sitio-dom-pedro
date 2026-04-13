/**
 * DateInput — campo de data com digitação manual (DD/MM/AAAA) e picker nativo.
 *
 * Props:
 *   value        ISO string ou undefined
 *   onChange     (isoString | undefined) => void
 *   includeTime  true para "DD/MM/AAAA HH:MM"
 *   placeholder  padrão automático conforme includeTime
 *   disabled
 *   className
 */

import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateInputProps {
  value?: string
  onChange: (iso: string | undefined) => void
  includeTime?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}

// ── Helpers de conversão ──────────────────────────────────────────────────────

function isoToDisplay(iso: string | undefined, includeTime: boolean): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    if (!includeTime) return `${dd}/${mm}/${yyyy}`
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`
  } catch {
    return ''
  }
}

function displayToIso(display: string, includeTime: boolean): string | undefined {
  const clean = display.replace(/\D/g, '')
  if (!includeTime) {
    if (clean.length < 8) return undefined
    const dd = parseInt(clean.slice(0, 2))
    const mm = parseInt(clean.slice(2, 4))
    const yyyy = parseInt(clean.slice(4, 8))
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined
    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0)
    if (isNaN(d.getTime())) return undefined
    return d.toISOString()
  } else {
    if (clean.length < 12) return undefined
    const dd = parseInt(clean.slice(0, 2))
    const mm = parseInt(clean.slice(2, 4))
    const yyyy = parseInt(clean.slice(4, 8))
    const hh = parseInt(clean.slice(8, 10))
    const min = parseInt(clean.slice(10, 12))
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || min > 59) return undefined
    const d = new Date(yyyy, mm - 1, dd, hh, min)
    if (isNaN(d.getTime())) return undefined
    return d.toISOString()
  }
}

function applyMask(raw: string, includeTime: boolean): string {
  const digits = raw.replace(/\D/g, '').slice(0, includeTime ? 12 : 8)
  if (!includeTime) {
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  } else {
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    if (digits.length <= 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
    if (digits.length <= 10)
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)} ${digits.slice(8)}`
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)} ${digits.slice(8, 10)}:${digits.slice(10)}`
  }
}

// ── Picker value helpers ──────────────────────────────────────────────────────

function isoToPickerValue(iso: string | undefined, includeTime: boolean): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    if (!includeTime) return `${yyyy}-${mm}-${dd}`
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`
  } catch {
    return ''
  }
}

function pickerValueToIso(val: string, includeTime: boolean): string | undefined {
  if (!val) return undefined
  try {
    const d = includeTime ? new Date(val) : new Date(val + 'T12:00:00')
    if (isNaN(d.getTime())) return undefined
    return d.toISOString()
  } catch {
    return undefined
  }
}

// ── Componente ────────────────────────────────────────────────────────────────

export function DateInput({
  value,
  onChange,
  includeTime = false,
  placeholder,
  disabled = false,
  className,
}: DateInputProps) {
  const [display, setDisplay] = useState(() => isoToDisplay(value, includeTime))
  const [invalid, setInvalid] = useState(false)
  const pickerRef = useRef<HTMLInputElement>(null)

  // Sincroniza display quando value muda externamente
  useEffect(() => {
    const fromValue = isoToDisplay(value, includeTime)
    setDisplay(fromValue)
    setInvalid(false)
  }, [value, includeTime])

  const ph = placeholder ?? (includeTime ? 'DD/MM/AAAA HH:MM' : 'DD/MM/AAAA')

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyMask(e.target.value, includeTime)
    setDisplay(masked)
    const iso = displayToIso(masked, includeTime)
    const isComplete = masked.replace(/\D/g, '').length === (includeTime ? 12 : 8)
    if (isComplete && !iso) {
      setInvalid(true)
    } else {
      setInvalid(false)
      onChange(iso)
    }
  }

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = pickerValueToIso(e.target.value, includeTime)
    onChange(iso)
    setDisplay(isoToDisplay(iso, includeTime))
    setInvalid(false)
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleTextChange}
        placeholder={ph}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 pr-9 text-sm shadow-sm',
          'transition-colors placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid
            ? 'border-destructive focus-visible:ring-destructive'
            : 'border-input',
        )}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => pickerRef.current?.showPicker?.()}
        className="absolute right-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
        tabIndex={-1}
        title="Abrir calendário"
      >
        <Calendar className="h-4 w-4" />
      </button>
      {/* Picker nativo oculto */}
      <input
        ref={pickerRef}
        type={includeTime ? 'datetime-local' : 'date'}
        value={isoToPickerValue(value, includeTime)}
        onChange={handlePickerChange}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      {invalid && (
        <p className="absolute -bottom-5 left-0 text-xs text-destructive">
          Data inválida
        </p>
      )}
    </div>
  )
}
