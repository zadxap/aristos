import { useEffect, useLayoutEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock"

const OPEN_EASE = "transform 300ms cubic-bezier(0.2, 0.7, 0.2, 1)"
const FADE_EASE = "opacity 250ms ease-out"
/** свайп-зона от левого края экрана */
const EDGE_PX = 48
/** доля ширины панели, после которой жест считается открытием/закрытием */
const RATIO = 0.35
/** скорость (px/ms), при которой жест доводится до конца независимо от дистанции */
const VELOCITY = 0.35

interface SideDrawerProps {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

interface DragState {
  startX: number
  startY: number
  /** прогресс 0..1 на момент начала жеста (закрыта=0, открыта=1) */
  base: 0 | 1
  claimed: boolean
  progress: number
  lastX: number
  lastT: number
  v: number
}

/** target внутри горизонтального скроллера (таблицы, ленты) — там свайп скроллит,
 *  а не открывает меню */
function insideHorizScroller(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null
  while (el && el !== document.body) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
      const s = getComputedStyle(el)
      if (/(auto|scroll)/.test(s.overflowX)) return true
    }
    el = el.parentElement
  }
  return false
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

/** Мобильная шторка (lg:hidden): выезжает слева, ВЕДЁТСЯ ЗА ПАЛЬЦЕМ.
 *  Свайп от левого края вправо — открыть, влево по панели — закрыть,
 *  тап по фону — закрыть. На десктопе не рендерится — там обычная модалка. */
export function SideDrawer({
  isOpen,
  onOpen,
  onClose,
  title,
  description,
  children,
}: SideDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(isOpen)
  const dragRef = useRef<DragState | null>(null)
  const mountedRef = useRef(false)
  // колбэки в ref — document-слушатели вешаются один раз
  const onOpenRef = useRef(onOpen)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onOpenRef.current = onOpen
    onCloseRef.current = onClose
  })

  const applySettled = (open: boolean, animate: boolean) => {
    const panel = panelRef.current
    const backdrop = backdropRef.current
    if (panel) {
      panel.style.transition = animate ? OPEN_EASE : "none"
      panel.style.transform = open
        ? "translate3d(0,0,0)"
        : "translate3d(-102%,0,0)"
    }
    if (backdrop) {
      backdrop.style.transition = animate ? FADE_EASE : "none"
      backdrop.style.opacity = open ? "1" : "0"
    }
  }

  // Первичная установка — до первой отрисовки, чтобы закрытая панель не мигнула
  useLayoutEffect(() => {
    const first = !mountedRef.current
    mountedRef.current = true
    openRef.current = isOpen
    applySettled(isOpen, !first && !dragRef.current?.claimed)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [isOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openRef.current) onCloseRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Жесты: document-level, non-passive touchmove (нужен preventDefault,
  // чтобы вертикальный скролл не дёргал страницу во время ведения панели)
  useEffect(() => {
    const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches

    const onTouchStart = (e: TouchEvent) => {
      if (isDesktop() || e.touches.length !== 1 || dragRef.current) return
      const t = e.touches[0]
      const wasOpen = openRef.current
      if (!wasOpen) {
        if (t.clientX > EDGE_PX) return
        // поверх открыта другая модалка/шторка — не перехватываем
        if (document.querySelector("[data-modal-open]")) return
        if (insideHorizScroller(e.target)) return
      } else {
        // закрытие жестом — только если палец на самой панели
        const panel = panelRef.current
        if (!(e.target instanceof Element) || !panel?.contains(e.target)) return
      }
      dragRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        base: wasOpen ? 1 : 0,
        claimed: false,
        progress: wasOpen ? 1 : 0,
        lastX: t.clientX,
        lastT: performance.now(),
        v: 0,
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      const d = dragRef.current
      if (!d) return
      const t = e.touches[0]
      const dx = t.clientX - d.startX
      const dy = t.clientY - d.startY

      if (!d.claimed) {
        // «в сторону открытия»: из закрытой — вправо, из открытой — влево
        const toward = d.base === 0 ? dx : -dx
        // вертикальное намерение на любом шаге решения — это скролл страницы.
        // Порог строгий: диагональный скролл с лёгким заносом не должен
        // перехватываться жестом (иначе скролл обрывается и панель «выглядывает»)
        if (Math.abs(dy) > 14 && Math.abs(dy) * 1.4 > Math.abs(dx)) {
          dragRef.current = null
          return
        }
        // забираем жест только при явном горизонтальном намерении
        if (toward < 26 || toward <= Math.abs(dy) * 1.5) return
        d.claimed = true
        const panel = panelRef.current
        if (panel) panel.style.transition = "none"
        if (backdropRef.current) backdropRef.current.style.transition = "none"
      }
      e.preventDefault()

      const width = panelRef.current?.offsetWidth || 320
      const p = clamp01(d.base === 0 ? dx / width : 1 + dx / width)
      d.progress = p
      const now = performance.now()
      d.v = (t.clientX - d.lastX) / Math.max(1, now - d.lastT)
      d.lastX = t.clientX
      d.lastT = now

      const panel = panelRef.current
      if (panel) panel.style.transform = `translate3d(${(p - 1) * 100}%,0,0)`
      if (backdropRef.current) backdropRef.current.style.opacity = String(p)
    }

    const onTouchEnd = (e: TouchEvent) => {
      const d = dragRef.current
      dragRef.current = null
      if (!d?.claimed) return
      // на экране остались другие пальцы — откат к settled-состоянию без решения
      if (e.touches.length > 0) {
        applySettled(openRef.current, true)
        return
      }
      // доводка скоростью либо по пройденной дистанции
      let open: boolean
      if (d.base === 0) open = d.progress > RATIO || d.v > VELOCITY
      else open = !(d.progress < 1 - RATIO || d.v < -VELOCITY)
      openRef.current = open
      applySettled(open, true)
      // состояние на момент начала жеста (d.base), не из замыкания —
      // слушатели вешаются один раз и не видят свежие пропсы
      if (open !== (d.base === 1)) {
        if (open) onOpenRef.current()
        else onCloseRef.current()
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: false })
    document.addEventListener("touchmove", onTouchMove, { passive: false })
    document.addEventListener("touchend", onTouchEnd, { passive: false })
    document.addEventListener("touchcancel", onTouchEnd, { passive: false })
    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)
      document.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [])

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden",
        !isOpen && "pointer-events-none"
      )}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 left-0 flex h-full w-[86vw] max-w-[22rem] flex-col rounded-r-2xl border-r border-border/80 bg-card shadow-2xl"
        style={{ touchAction: "pan-y" }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight break-words text-foreground">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
