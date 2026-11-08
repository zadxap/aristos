import { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNavItems } from "@/lib/nav-items"
import { kk } from "@/i18n"
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock"

/** Нижняя навигация (мобайл): 3 главных раздела + «Көбірек» — шторка с остальными.
 *  Шторка закрывается тапом по фону и свайпом вниз. */
export function BottomNav() {
  const navItems = useNavItems()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    startY: number
    dy: number
    claimed: boolean
    lastY: number
    lastT: number
    v: number
  } | null>(null)

  const primary = navItems.filter((item) =>
    ["/", "/calendar", "/deadlines"].includes(item.to)
  )
  const rest = navItems.filter(
    (item) => !["/", "/calendar", "/deadlines"].includes(item.to)
  )

  const close = () => setMoreOpen(false)

  // Страница под шторкой не прокручивается
  useEffect(() => {
    if (!moreOpen) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [moreOpen])

  // Свайп вниз по шторке — закрыть (панель ведётся за пальцем)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    dragRef.current = {
      startY: t.clientY,
      dy: 0,
      claimed: false,
      lastY: t.clientY,
      lastT: performance.now(),
      v: 0,
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const d = dragRef.current
    const sheet = sheetRef.current
    if (!d || !sheet) return
    const t = e.touches[0]
    d.dy = t.clientY - d.startY
    if (!d.claimed) {
      if (d.dy <= 8) return // ещё не жест вниз — не мешаем скроллу/тапам
      d.claimed = true
      sheet.style.transition = "none"
    }
    if (d.dy > 0) {
      const now = performance.now()
      d.v = (t.clientY - d.lastY) / Math.max(1, now - d.lastT)
      d.lastY = t.clientY
      d.lastT = now
      sheet.style.transform = `translateY(${d.dy}px)`
    }
  }
  const onTouchEnd = () => {
    const d = dragRef.current
    dragRef.current = null
    const sheet = sheetRef.current
    if (!d?.claimed || !sheet) return
    const dismiss = d.dy > 90 || d.v > 0.5
    sheet.style.transition = "transform 300ms cubic-bezier(0.2, 0.7, 0.2, 1)"
    sheet.style.transform = dismiss ? "translateY(105%)" : "translateY(0)"
    window.setTimeout(() => {
      if (sheetRef.current) sheetRef.current.style.transform = ""
    }, 320)
    if (dismiss) close()
  }

  return (
    <>
      <nav
        aria-label={kk.navAria}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-xl grid-cols-4 items-stretch px-2">
          {primary.map(({ to, label, icon: Icon, isActive }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "rounded-xl p-1 transition-colors",
                  isActive && "bg-primary/10"
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="max-w-full truncate px-1 text-[10px] leading-none font-medium tracking-tight">
                {label}
              </span>
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors duration-200",
              moreOpen
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-expanded={moreOpen}
          >
            <span
              className={cn(
                "rounded-xl p-1 transition-colors",
                moreOpen && "bg-primary/10"
              )}
            >
              <MoreHorizontal className="size-5" />
            </span>
            <span className="max-w-full truncate px-1 text-[10px] leading-none font-medium tracking-tight">
              {kk.navMore}
            </span>
          </button>
        </div>
      </nav>

      {/* Шторка «Көбірек»: остальные страницы. data-modal-open — чтобы свайп-жест
          меню не срабатывал, пока открыта эта шторка. */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          !moreOpen && "pointer-events-none"
        )}
        data-modal-open={moreOpen ? "" : undefined}
        aria-hidden={!moreOpen}
        inert={!moreOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity duration-300",
            moreOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={close}
          aria-hidden="true"
        />
        <div
          ref={sheetRef}
          className={cn(
            "absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border/80 bg-card p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-300 ease-out",
            moreOpen ? "translate-y-0" : "translate-y-full"
          )}
          role="dialog"
          aria-label={kk.navMore}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div
            className="mx-auto mb-1 h-1 w-10 cursor-grab rounded-full bg-border"
            aria-hidden="true"
          />
          {rest.map(({ to, label, icon: Icon, isActive }) => (
            <Link
              key={to}
              to={to}
              onClick={close}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                isActive || pathname.startsWith(to)
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/90 hover:bg-muted"
              )}
            >
              <Icon className="size-4.5" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
