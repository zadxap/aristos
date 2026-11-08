import { useState, useSyncExternalStore } from "react"
import { Link, useLocation } from "react-router-dom"
import { SideMenu } from "./SideMenu"
import { CanvasSyncListener } from "./CanvasSyncListener"
import { NotificationAgent } from "./NotificationAgent"
import { BottomNav } from "./BottomNav"
import { sideMenuStore } from "@/lib/menu-store"
import { useAristosDB } from "@/context/DBContext"
import { kk } from "@/i18n"
import { Menu, Settings2, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmProvider } from "@/components/ui/confirm"
import { cn } from "@/lib/utils"
import { useNavItems } from "@/lib/nav-items"

interface AppLayoutProps {
  children: React.ReactNode
}

const COLLAPSED_KEY = "aristos-sidebar-collapsed"

export function AppLayout({ children }: AppLayoutProps) {
  // Открытость панели — во внешнем сторе: смена языка перемонтирует дерево
  // (key={lang} в LangProvider), и локальный useState здесь сбрасывался —
  // поэтому меню закрывалось при переключении языка.
  const menuOpen = useSyncExternalStore(
    sideMenuStore.subscribe,
    sideMenuStore.get
  )
  const setMenuOpen = sideMenuStore.set
  const { activeCourse, activeSemester, editMode } = useAristosDB()
  const location = useLocation()
  const navItems = useNavItems()

  // Свёрнутый рельс (только иконки) — переживает перезагрузку и смену языка
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(COLLAPSED_KEY) === "1"
  )
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1")
      return !prev
    })
  }

  return (
    <ConfirmProvider>
      <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border/80 bg-card/40 transition-[width] duration-200 lg:flex",
            collapsed ? "w-[68px]" : "w-60"
          )}
        >
          {/* Логотип = кнопка сворачивания: при наведении появляется шеврон
              (в свёрнутом рельсе он ЗАМЕНЯЕТ логотип, а не встаёт рядом) */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? kk.sidebarExpand : kk.sidebarCollapse}
            className={cn(
              "group relative flex w-full items-center gap-2.5 pt-6 pb-4 text-left",
              collapsed ? "justify-center px-0" : "px-5"
            )}
          >
            {collapsed ? (
              <span className="relative flex size-9 items-center justify-center">
                <img
                  src="/icons/icon.svg"
                  alt="Aristos"
                  className="size-9 rounded-xl shadow-sm transition-opacity group-hover:opacity-0"
                />
                <PanelLeftOpen className="absolute inset-0 m-auto size-5 text-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            ) : (
              <>
                <img
                  src="/icons/icon.svg"
                  alt="Aristos"
                  className="size-9 shrink-0 rounded-xl shadow-sm transition-transform group-hover:scale-105"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-base leading-none font-bold tracking-tight text-foreground">
                    {kk.appName}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {kk.appSubtitle}
                  </p>
                </div>
                <PanelLeftClose className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </>
            )}
          </button>

          <nav
            aria-label={kk.navAria}
            className={cn(
              "flex-1 space-y-1 overflow-y-auto",
              collapsed ? "px-2" : "px-3"
            )}
          >
            {navItems.map(({ to, label, icon: Icon, isActive }) => (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center rounded-xl text-sm font-medium transition-colors duration-200",
                  collapsed
                    ? "justify-center px-0 py-2.5"
                    : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && label}
              </Link>
            ))}
          </nav>

          <div
            className={cn(
              collapsed
                ? "flex flex-col items-center gap-3 px-0 pb-4"
                : "space-y-3 p-4"
            )}
          >
            <Button
              variant="outline"
              size={collapsed ? "icon" : "sm"}
              onClick={() => setMenuOpen(true)}
              title={collapsed ? kk.menu : undefined}
              className={cn(
                "gap-2 text-xs",
                collapsed && "size-9",
                !collapsed && "w-full justify-start"
              )}
            >
              <Settings2
                className={cn("shrink-0 text-primary", collapsed && "size-4")}
              />
              {!collapsed && kk.menu}
            </Button>
            {!collapsed && (
              <p className="text-center text-[11px] text-muted-foreground">
                {kk.offlinePwa}
              </p>
            )}
          </div>
        </aside>

        <div
          className={cn(
            "flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200",
            collapsed ? "lg:pl-[68px]" : "lg:pl-60"
          )}
        >
          {/* Mobile header */}
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md lg:hidden">
            <div className="flex h-14 w-full items-center justify-between gap-2 px-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  onClick={() => setMenuOpen(true)}
                  aria-label="Мәзірді ашу"
                  className="-ml-2 rounded-xl p-2 text-foreground transition-colors hover:bg-muted/80"
                >
                  <Menu className="size-5" />
                </button>
                <img
                  src="/icons/icon.svg"
                  alt="Aristos"
                  className="size-7 shrink-0 rounded-lg"
                />
                <span className="truncate text-lg font-bold tracking-tight text-primary">
                  {kk.appName}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {editMode && (
                  <Badge variant="blue" className="px-2 py-0.5 text-[10px]">
                    {kk.modeEdit}
                  </Badge>
                )}
                <button
                  onClick={() => setMenuOpen(true)}
                  title={kk.selectCourse + " / " + kk.selectSemester}
                  className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <span>{kk.courseShortN(activeCourse)}</span>
                  <span>•</span>
                  <span>{kk.semShortN(activeSemester)}</span>
                </button>
              </div>
            </div>
          </header>

          {/* Desktop topbar */}
          <header className="sticky top-0 z-30 hidden h-14 items-center justify-end gap-2 border-b border-border/60 bg-background/85 px-8 backdrop-blur-md lg:flex">
            {editMode && (
              <Badge variant="blue" className="px-2 py-0.5 text-[10px]">
                {kk.modeEdit}
              </Badge>
            )}
            <button
              onClick={() => setMenuOpen(true)}
              title={kk.selectCourse + " / " + kk.selectSemester}
              className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <span>{kk.courseShortN(activeCourse)}</span>
              <span>•</span>
              <span>{kk.semShortN(activeSemester)}</span>
            </button>
          </header>

          {/* Main Content Area */}
          <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-7 lg:pb-10">
            <div key={location.pathname} className="page-enter min-w-0">
              {children}
            </div>
          </main>
        </div>

        {/* Side Menu (десктоп — модалка, мобайл — шторка: настройки, импорт/экспорт, тема/язык) */}
        <SideMenu
          isOpen={menuOpen}
          onOpen={() => setMenuOpen(true)}
          onClose={() => setMenuOpen(false)}
        />

        {/* Accepts Canvas sync payloads from the userscript / extension */}
        <CanvasSyncListener />

        {/* Локальные уведомления: пары и дедлайны (пока приложение открыто) */}
        <NotificationAgent />

        {/* Bottom Navigation */}
        <BottomNav />
      </div>
    </ConfirmProvider>
  )
}
