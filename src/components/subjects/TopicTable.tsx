import { useState, useMemo } from "react"
import type { Topic } from "@/types"
import { kk } from "@/i18n"
import { useConfirm } from "@/components/ui/confirm"
import { Button } from "@/components/ui/button"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TopicTableProps {
  topics: Topic[]
  currentWeek?: number
  /** режим редактирования: правка/добавление/удаление тем с сохранением через onSave */
  editMode?: boolean
  onSave?: (topics: Topic[]) => void
}

const INPUT_CLASS =
  "w-full rounded-lg border border-border/80 bg-card px-2 py-1.5 text-sm text-foreground shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"

type IndexedTopic = Topic & { index: number }

export function TopicTable({
  topics,
  currentWeek,
  editMode,
  onSave,
}: TopicTableProps) {
  const confirm = useConfirm()

  // index в исходном массиве — стабильная идентичность строк (у тем нет id)
  const indexed = useMemo(
    () => topics.map((topic, index) => ({ ...topic, index })),
    [topics]
  )

  // Dynamically extract all unique topic types from the subject
  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(topics.map((t) => t.type.toLowerCase())))
    return types
  }, [topics])

  const [activeType, setActiveType] = useState<string>(
    () => availableTypes[0] || "all"
  )

  /** index редактируемой строки в topics (null — ничего не редактируем) */
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  /** добавление новой темы — черновик без существующего индекса */
  const [adding, setAdding] = useState(false)
  /** черновик формы (редактирование и добавление) */
  const [draft, setDraft] = useState<Topic | null>(null)

  const getLessonTypeLabel = (type: string) => {
    return (kk.lessonTypes as Record<string, string>)[type] || type
  }

  // известные типы + кастомные из JSON, чтобы импортированные не потерялись
  const typeOptions = useMemo(() => {
    const known = Object.keys(kk.lessonTypes as Record<string, string>)
    const custom = topics
      .map((t) => t.type)
      .filter((t) => !known.some((k) => k.toLowerCase() === t.toLowerCase()))
    return [...new Set([...known, ...custom])]
  }, [topics])

  const filteredTopics = useMemo(() => {
    if (activeType === "all") return indexed
    return indexed
      .filter((t) => t.type.toLowerCase() === activeType.toLowerCase())
      .sort((a, b) => a.week - b.week)
  }, [indexed, activeType])

  const draftValid =
    draft !== null &&
    Number.isFinite(draft.week) &&
    draft.week >= 1 &&
    draft.topic.trim() !== ""

  if (!editMode && (!topics || topics.length === 0)) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        {kk.noTopics}
      </div>
    )
  }

  const startEdit = (item: IndexedTopic) => {
    setAdding(false)
    setEditingIndex(item.index)
    setDraft({ type: item.type, week: item.week, topic: item.topic })
  }

  const startAdd = () => {
    setEditingIndex(null)
    setAdding(true)
    setDraft({
      type: availableTypes[0] ?? "lecture",
      week: currentWeek ?? 1,
      topic: "",
    })
  }

  const cancel = () => {
    setEditingIndex(null)
    setAdding(false)
    setDraft(null)
  }

  const commit = () => {
    if (!draftValid || !draft || !onSave) return
    const next = [...topics]
    const clean: Topic = {
      type: draft.type,
      week: Math.round(draft.week),
      topic: draft.topic.trim(),
    }
    if (adding) next.push(clean)
    else if (editingIndex !== null) next[editingIndex] = clean
    onSave(next)
    cancel()
  }

  const remove = async (index: number) => {
    if (!onSave) return
    const ok = await confirm({
      title: kk.topicDeleteConfirm,
      destructive: true,
    })
    if (!ok) return
    onSave(topics.filter((_, i) => i !== index))
  }

  /** форма правки/добавления — одна и та же для строки и для новой темы */
  const renderDraftForm = () => {
    if (!draft) return null
    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
          <label className="min-w-0 space-y-1">
            <span className="block text-[10px] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
              {kk.topicFieldWeek}
            </span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={Number.isFinite(draft.week) ? draft.week : ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  week:
                    e.target.value === "" ? Number.NaN : Number(e.target.value),
                })
              }
              className={INPUT_CLASS}
            />
          </label>
          <label className="min-w-0 space-y-1">
            <span className="block text-[10px] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
              {kk.topicFieldType}
            </span>
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              className={INPUT_CLASS}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {getLessonTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="block text-[10px] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
            {kk.topicFieldTitle}
          </span>
          <textarea
            rows={2}
            value={draft.topic}
            onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
            className={cn(INPUT_CLASS, "resize-y leading-relaxed")}
          />
        </label>
        {!draftValid && (
          <p className="text-[11px] text-muted-foreground">
            {kk.topicSaveHint}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={cancel}>
            {kk.cancel}
          </Button>
          <Button size="sm" disabled={!draftValid} onClick={commit}>
            {kk.save}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Type Tabs */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-1">
          <button
            onClick={() => setActiveType("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeType === "all"
                ? "bg-card font-semibold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {kk.all} ({topics.length})
          </button>

          {availableTypes.map((type) => {
            const count = topics.filter(
              (t) => t.type.toLowerCase() === type
            ).length
            const isSelected = activeType === type

            return (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-card font-semibold text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {getLessonTypeLabel(type)} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Topics List */}
      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/80 bg-card">
        {filteredTopics.map((item) => {
          const isCurrentWeek = currentWeek === item.week
          const isEditing = editingIndex === item.index

          return (
            <div
              key={item.index}
              className={`flex items-start gap-3 p-3.5 transition-colors sm:p-4 ${
                isCurrentWeek && !isEditing
                  ? "bg-primary/5 dark:bg-primary/10"
                  : "hover:bg-muted/30"
              }`}
            >
              {isEditing ? (
                <div className="min-w-0 flex-1">{renderDraftForm()}</div>
              ) : (
                <>
                  <div className="flex shrink-0 flex-col items-center">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                        isCurrentWeek
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {kk.weekShort(item.week)}
                    </span>
                    {activeType === "all" && (
                      <span className="mt-1 text-[10px] font-medium text-muted-foreground">
                        {getLessonTypeLabel(item.type)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed text-foreground sm:text-sm">
                      {item.topic}
                    </p>
                    {isCurrentWeek && (
                      <span className="mt-1 inline-block text-[11px] font-semibold text-primary">
                        {kk.currentWeekLabel}
                      </span>
                    )}
                  </div>

                  {editMode && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => startEdit(item)}
                        title={kk.edit}
                        aria-label={kk.edit}
                        className="-m-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => remove(item.index)}
                        title={kk.delete}
                        aria-label={kk.delete}
                        className="-m-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}

        {/* Форма новой темы — в конце списка */}
        {adding && (
          <div className="bg-muted/20 p-3.5 sm:p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                {kk.weekShort(
                  draft && Number.isFinite(draft.week) ? draft.week : 0
                )}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {kk.topicAdd}
              </span>
            </div>
            {renderDraftForm()}
          </div>
        )}
      </div>

      {editMode && !adding && (
        <Button
          variant="outline"
          size="sm"
          onClick={startAdd}
          className="w-full sm:w-auto"
        >
          <Plus className="size-3.5 text-primary" />
          {kk.topicAdd}
        </Button>
      )}
    </div>
  )
}
