import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // Страница под модалкой не прокручивается (на телефоне жест уходит в фон)
  React.useEffect(() => {
    if (!isOpen) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [isOpen])

  if (!isOpen) return null

  return (
    // Диалог ограничен высотой вьюпорта: заголовок с крестиком всегда на месте,
    // контент скроллится внутри. Центрирование через фикс. max-h — иначе
    // flex-center + overflow срезает верх длинной модалки на телефоне.
    <div
      data-modal-open
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-3 fade-in sm:p-6"
    >
      {/* Backdrop — цвет привязан к теме, размытие лёгкое */}
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="flex min-h-full items-center justify-center">
        <div
          className={cn(
            "modal-in relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg min-w-0 flex-col rounded-2xl border border-border/80 bg-card shadow-xl transition-all sm:max-h-[calc(100dvh-3rem)]",
            className
          )}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight break-words text-foreground">
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="-mr-1 shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4 sm:px-6 sm:pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
