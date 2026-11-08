import { useLayoutEffect, useRef, useState } from "react"
import { useAristosDB } from "@/context/DBContext"
import { useCurrentStatus } from "@/hooks/useCurrentStatus"
import { WeekProgress } from "@/components/home/WeekProgress"
import { StatusCard } from "@/components/home/StatusCard"
import { UpcomingDeadlines } from "@/components/home/UpcomingDeadlines"
import { WeeklyAdviceCard } from "@/components/ai/WeeklyAdviceCard"
import { SubjectRadar } from "@/components/home/SubjectRadar"
import { DayTabs } from "@/components/home/DayTabs"
import { LessonList } from "@/components/home/LessonList"
import { GpaMiniCard } from "@/components/home/GpaMiniCard"
import { TomorrowSchedule } from "@/components/home/TomorrowSchedule"
import { NotesCard } from "@/components/home/NotesCard"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { kk } from "@/i18n"
import { getAcademicWeek } from "@/lib/academic-week"
import type { DayOfWeek } from "@/types"
import {
  ALL_HOME_BLOCKS,
  DEFAULT_HOME_LAYOUT,
  loadHomeLayout,
  moveWithin,
  moveToOtherColumn,
  resetHomeLayout,
  saveHomeLayout,
  type HomeBlockId,
  type HomeLayout,
} from "@/lib/home-layout"
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
} from "lucide-react"

const JS_DAY_MAP: DayOfWeek[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
]

export function HomePage() {
  const {
    loading,
    activeSemester,
    subjects,
    schedule,
    calendar,
    editMode,
    updateSchedule,
  } = useAristosDB()

  // Default to today's day (or mon if sun)
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => {
    const todayIndex = new Date().getDay()
    return JS_DAY_MAP[todayIndex]
  })

  const currentStatus = useCurrentStatus(
    schedule,
    calendar,
    subjects,
    activeSemester
  )

  const activeSem = calendar?.semesters?.find(
    (s) => s.semester === activeSemester
  )
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const isAcademicPeriod = Boolean(
    activeSem &&
    todayKey >= activeSem.semester_start &&
    todayKey <= activeSem.semester_end
  )
  const currentWeek = activeSem
    ? getAcademicWeek(
        new Date(),
        activeSem.semester_start,
        activeSem.total_weeks
      )
    : 1

  // Filter lessons for selected day
  const dayEntries = (isAcademicPeriod ? schedule?.schedule || [] : [])
    .filter((entry) => entry.day.toLowerCase() === selectedDay)
    .sort((a, b) => a.start.localeCompare(b.start))

  const handleDeleteEntry = async (entryIndex: number) => {
    if (!schedule) return
    const entryToDelete = dayEntries[entryIndex]
    const updated = schedule.schedule.filter((e) => e !== entryToDelete)
    await updateSchedule({ ...schedule, schedule: updated })
  }

  const handleEditEntry = async (
    entryIndex: number,
    updatedEntry: (typeof dayEntries)[number]
  ) => {
    if (!schedule) return
    const originalEntry = dayEntries[entryIndex]
    const updated = schedule.schedule.map((entry) =>
      entry === originalEntry ? updatedEntry : entry
    )
    await updateSchedule({ ...schedule, schedule: updated })
  }

  // Раскладка главной: кастомная расстановка блоков (режим редактирования меняет её).
  // Хуки — до раннего return при loading.
  const [layout, setLayoutState] = useState<HomeLayout>(loadHomeLayout)

  // Плавное перемещение блоков (FLIP): до мутации запоминаем позиции,
  // после рендера доигрываем сдвиг до нового места.
  const prevRectsRef = useRef<Map<HomeBlockId, DOMRect>>(new Map())
  const withFlip = (mutate: () => void) => {
    const rects = new Map<HomeBlockId, DOMRect>()
    for (const id of ALL_HOME_BLOCKS) {
      const el = document.querySelector(`[data-block="${id}"]`)
      if (el) rects.set(id, el.getBoundingClientRect())
    }
    prevRectsRef.current = rects
    mutate()
  }

  useLayoutEffect(() => {
    const prevRects = prevRectsRef.current
    if (prevRects.size === 0) return
    prevRectsRef.current = new Map()
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    for (const id of ALL_HOME_BLOCKS) {
      const el = document.querySelector(`[data-block="${id}"]`)
      const prev = prevRects.get(id)
      if (!el || !prev) continue
      const next = el.getBoundingClientRect()
      const dx = prev.left - next.left
      const dy = prev.top - next.top
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 350, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" }
      )
    }
  }, [layout])

  const setLayout = (next: HomeLayout) => {
    setLayoutState(next)
    saveHomeLayout(next)
  }
  const moveBlock = (id: HomeBlockId, delta: -1 | 1) => {
    if (layout.main.includes(id))
      withFlip(() =>
        setLayout({ ...layout, main: moveWithin(layout.main, id, delta) })
      )
    else
      withFlip(() =>
        setLayout({ ...layout, aside: moveWithin(layout.aside, id, delta) })
      )
  }
  const toggleColumn = (id: HomeBlockId) =>
    withFlip(() => setLayout(moveToOtherColumn(layout, id)))
  const hideBlock = (id: HomeBlockId) =>
    withFlip(() =>
      setLayout({
        main: layout.main.filter((b) => b !== id),
        aside: layout.aside.filter((b) => b !== id),
      })
    )
  const showBlock = (id: HomeBlockId) => {
    // возвращаем в «родную» колонку из дефолтной раскладки
    if (DEFAULT_HOME_LAYOUT.main.includes(id))
      withFlip(() => setLayout({ ...layout, main: [...layout.main, id] }))
    else withFlip(() => setLayout({ ...layout, aside: [...layout.aside, id] }))
  }
  const resetLayout = () => setLayoutState(resetHomeLayout())
  const hiddenBlocks = ALL_HOME_BLOCKS.filter(
    (id) => !layout.main.includes(id) && !layout.aside.includes(id)
  )

  // Drag-n-drop: схватили ручку → блок под курсором подсвечивается линией
  // вставки → на отпускании переставляем и отыгрывает FLIP-анимация
  const [dragId, setDragId] = useState<HomeBlockId | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    id: HomeBlockId
    before: boolean
  } | null>(null)
  const dragPointer = useRef<{
    startX: number
    startY: number
    moved: boolean
  } | null>(null)

  const handleDragStart = (id: HomeBlockId, e: React.PointerEvent) => {
    e.preventDefault()
    // capture держит события на ручке при быстром свайпе; на синтетическом
    // указателе (тесты) браузер кидает NotFoundError — без capture тоже работает
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* пусто */
    }
    dragPointer.current = { startX: e.clientX, startY: e.clientY, moved: false }
    setDragId(id)
  }
  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragPointer.current || dragId === null) return
    if (!dragPointer.current.moved) {
      const dist = Math.hypot(
        e.clientX - dragPointer.current.startX,
        e.clientY - dragPointer.current.startY
      )
      if (dist < 8) return
      dragPointer.current.moved = true
    }
    const el = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("[data-block]") as HTMLElement | null
    const targetId =
      (el?.getAttribute("data-block") as HomeBlockId | null) ?? null
    if (targetId && targetId !== dragId) {
      const rect = el!.getBoundingClientRect()
      setDropTarget({
        id: targetId,
        before: e.clientY < rect.top + rect.height / 2,
      })
    } else {
      setDropTarget(null)
    }
  }
  const handleDragEnd = () => {
    const target = dropTarget
    if (dragId !== null && target) {
      const without: HomeLayout = {
        main: layout.main.filter((b) => b !== dragId),
        aside: layout.aside.filter((b) => b !== dragId),
      }
      const column: "main" | "aside" = without.main.includes(target.id)
        ? "main"
        : "aside"
      const list = [...without[column]]
      const idx = list.indexOf(target.id)
      list.splice(target.before ? idx : idx + 1, 0, dragId)
      withFlip(() => setLayout({ ...without, [column]: list }))
    }
    dragPointer.current = null
    setDragId(null)
    setDropTarget(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const renderBlock = (id: HomeBlockId) => {
    switch (id) {
      case "status":
        return <StatusCard status={currentStatus} />
      case "gpa":
        return <GpaMiniCard />
      case "notes":
        return <NotesCard />
      case "tomorrow": {
        // следующий день недели (вс → пн)
        const tomorrowKey = JS_DAY_MAP[(new Date().getDay() + 1) % 7]
        const tomorrowEntries = (
          isAcademicPeriod ? schedule?.schedule || [] : []
        )
          .filter((entry) => entry.day.toLowerCase() === tomorrowKey)
          .sort((a, b) => a.start.localeCompare(b.start))
        return (
          <TomorrowSchedule
            entries={tomorrowEntries}
            dayLabel={kk.daysFull[tomorrowKey]}
            isAcademicPeriod={isAcademicPeriod}
          />
        )
      }
      case "week":
        return (
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-4">
              <WeekProgress
                calendar={calendar}
                activeSemester={activeSemester}
              />
            </CardContent>
          </Card>
        )
      case "schedule":
        return (
          <div className="min-w-0 space-y-4">
            <DayTabs selectedDay={selectedDay} onSelectDay={setSelectedDay} />
            <section className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold tracking-tight">
                  {kk.weeklySchedule}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {kk.lessonsCount(dayEntries.length)}
                </span>
              </div>
              <LessonList
                entries={dayEntries}
                subjects={subjects}
                currentWeek={currentWeek}
                selectedDay={selectedDay}
                editMode={editMode}
                onDeleteEntry={handleDeleteEntry}
                onEditEntry={handleEditEntry}
              />
            </section>
          </div>
        )
      case "deadlines":
        return <UpcomingDeadlines />
      case "advice":
        return <WeeklyAdviceCard />
      case "radar":
        return <SubjectRadar />
    }
  }

  return (
    <div className="space-y-6">
      <header className="mb-2">
        <p className="text-sm font-medium text-primary">{kk.homeBadge}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {kk.homeTitle}
        </h1>
      </header>

      {/* Редактор раскладки — только в режиме редактирования */}
      {editMode && (
        <div className="space-y-2 rounded-2xl border border-border/70 bg-card/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">
              {kk.homeLayout}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetLayout}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="size-3 text-primary" />
              {kk.homeLayoutReset}
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {kk.homeLayoutHint}
          </p>
          {hiddenBlocks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                {kk.homeBlockHidden}:
              </span>
              {hiddenBlocks.map((id) => (
                <button
                  key={id}
                  onClick={() => showBlock(id)}
                  title={kk.homeBlockShow}
                  className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Eye className="size-3" />
                  {kk.homeBlocks[id]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Desktop: main column + widget rail. Mobile: single column. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {layout.main.map((id, index) => (
            <BlockShell
              key={id}
              id={id}
              editMode={editMode}
              isFirst={index === 0}
              isLast={index === layout.main.length - 1}
              isDragging={dragId === id}
              isDropBefore={dropTarget?.id === id && !!dropTarget.before}
              isDropAfter={dropTarget?.id === id && !dropTarget.before}
              onMove={moveBlock}
              onToggleColumn={toggleColumn}
              onHide={hideBlock}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
            >
              {renderBlock(id)}
            </BlockShell>
          ))}
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
          {layout.aside.map((id, index) => (
            <BlockShell
              key={id}
              id={id}
              editMode={editMode}
              isFirst={index === 0}
              isLast={index === layout.aside.length - 1}
              isDragging={dragId === id}
              isDropBefore={dropTarget?.id === id && !!dropTarget.before}
              isDropAfter={dropTarget?.id === id && !dropTarget.before}
              onMove={moveBlock}
              onToggleColumn={toggleColumn}
              onHide={hideBlock}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
            >
              {renderBlock(id)}
            </BlockShell>
          ))}
        </aside>
      </div>
    </div>
  )
}

/** Обёртка блока: в режиме редактирования резервирует сверху полоску
 *  под панель управления (чтобы панель не наезжала на содержимое карточки)
 *  и подсвечивает drag-n-drop состояния. */
function BlockShell({
  id,
  editMode,
  isFirst,
  isLast,
  isDragging,
  isDropBefore,
  isDropAfter,
  onMove,
  onToggleColumn,
  onHide,
  onDragStart,
  onDragMove,
  onDragEnd,
  children,
}: {
  id: HomeBlockId
  editMode: boolean
  isFirst: boolean
  isLast: boolean
  isDragging?: boolean
  isDropBefore?: boolean
  isDropAfter?: boolean
  onMove: (id: HomeBlockId, delta: -1 | 1) => void
  onToggleColumn: (id: HomeBlockId) => void
  onHide: (id: HomeBlockId) => void
  onDragStart?: (id: HomeBlockId, e: React.PointerEvent) => void
  onDragMove?: (e: React.PointerEvent) => void
  onDragEnd?: () => void
  children: React.ReactNode
}) {
  if (!editMode) return <div data-block={id}>{children}</div>
  return (
    <div
      data-block={id}
      className={cn(
        "relative min-w-0 pt-11",
        isDragging && "opacity-40",
        isDropBefore &&
          "before:absolute before:inset-x-1 before:-top-2.5 before:h-1 before:rounded-full before:bg-primary",
        isDropAfter &&
          "after:absolute after:inset-x-1 after:-bottom-2.5 after:h-1 after:rounded-full after:bg-primary"
      )}
    >
      <div
        className={cn(
          "absolute top-1.5 right-1 z-10 flex items-center gap-0.5 rounded-xl border border-border/70 bg-background/95 p-1 shadow-xs",
          isDragging && "invisible"
        )}
      >
        {/* ручка drag-n-drop: pointer-события, тач не скроллит страницу */}
        <button
          type="button"
          title={kk.homeBlockDrag}
          aria-label={kk.homeBlockDrag}
          onPointerDown={(e) => onDragStart?.(id, e)}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="flex size-7 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <CtlButton
          title={kk.homeBlockMoveUp}
          disabled={isFirst}
          onClick={() => onMove(id, -1)}
        >
          <ArrowUp className="size-3.5" />
        </CtlButton>
        <CtlButton
          title={kk.homeBlockMoveDown}
          disabled={isLast}
          onClick={() => onMove(id, 1)}
        >
          <ArrowDown className="size-3.5" />
        </CtlButton>
        {/* на телефоне одна колонка — перенос смысла не имеет, только lg+ */}
        <CtlButton
          title={kk.homeBlockMoveColumn}
          onClick={() => onToggleColumn(id)}
          className="hidden lg:flex"
        >
          <ArrowLeftRight className="size-3.5" />
        </CtlButton>
        <CtlButton title={kk.homeBlockHide} onClick={() => onHide(id)}>
          <EyeOff className="size-3.5" />
        </CtlButton>
      </div>
      {children}
    </div>
  )
}

function CtlButton({
  title,
  disabled,
  onClick,
  className,
  children,
}: {
  title: string
  disabled?: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
        className
      )}
    >
      {children}
    </button>
  )
}
