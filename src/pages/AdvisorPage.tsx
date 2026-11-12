import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  History,
  MessageSquare,
  MessageSquareDashed,
  Plus,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useConfirm } from "@/components/ui/confirm"
import { kk } from "@/i18n"
import { useAristosDB } from "@/context/DBContext"
import { buildAdvisorContext } from "@/lib/aiContext"
import {
  chatComplete,
  isAiConfigured,
  loadAiSettings,
  saveAiSettings,
  type AiSettings,
} from "@/lib/aiClient"
import { cn } from "@/lib/utils"
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock"

const SYSTEM_PROMPT = `Ты — академический советник студента казахстанского вуза (Yessenov University).
Отвечай по-русски, кратко и по делу. Используй ТОЛЬКО данные из контекста — не выдумывай цифры.
Схема: РК1+РК2 → Рейтинг = (РК1+РК2)/2, Итог = 0.6×Рейтинг + 0.4×Экзамен.
Помогай с: анализом успеваемости, планированием, GPA what-if, стратегией на неделю.`

interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

interface ChatSession {
  id: string
  title: string
  updatedAt: string
  messages: ChatMessage[]
}

const SESSIONS_KEY = "ai-advisor-chats"
const MAX_SESSIONS = 20

function loadSessions(): ChatSession[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(SESSIONS_KEY) || "[]"
    ) as ChatSession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `chat-${Date.now()}`
}

function formatChatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const hours = String(d.getHours()).padStart(2, "0")
    const mins = String(d.getMinutes()).padStart(2, "0")
    if (isToday) return `${hours}:${mins}`
    const day = String(d.getDate()).padStart(2, "0")
    const month = String(d.getMonth() + 1).padStart(2, "0")
    return `${day}.${month} ${hours}:${mins}`
  } catch {
    return ""
  }
}

function renderBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

export function AdvisorPage() {
  const {
    canvasAssignments,
    canvasCourses,
    platonusYears,
    subjects,
    activeCourse,
    activeSemester,
    calendar,
    schedule,
  } = useAristosDB()
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Свайп вправо по шторке истории — закрыть (панель ведётся за пальцем)
  const historyPanelRef = useRef<HTMLDivElement>(null)
  const historyDragRef = useRef<{
    startX: number
    startY: number
    dx: number
    claimed: boolean
    lastX: number
    lastT: number
    vx: number
  } | null>(null)

  // Страница под шторкой не прокручивается
  useEffect(() => {
    if (!historyOpen) return
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [historyOpen])

  const onHistoryTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    historyDragRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      dx: 0,
      claimed: false,
      lastX: t.clientX,
      lastT: performance.now(),
      vx: 0,
    }
  }
  const onHistoryTouchMove = (e: React.TouchEvent) => {
    const d = historyDragRef.current
    const panel = historyPanelRef.current
    if (!d || !panel) return
    const t = e.touches[0]
    d.dx = t.clientX - d.startX
    const dy = t.clientY - d.startY
    if (!d.claimed) {
      // вертикальное намерение — это скролл списка чатов, не жест
      if (Math.abs(dy) > 14 && Math.abs(dy) * 1.4 > Math.abs(d.dx)) {
        historyDragRef.current = null
        return
      }
      if (d.dx < 26 || d.dx <= Math.abs(dy) * 1.5) return
      d.claimed = true
      panel.style.transition = "none"
    }
    if (d.dx > 0) {
      const now = performance.now()
      d.vx = (t.clientX - d.lastX) / Math.max(1, now - d.lastT)
      d.lastX = t.clientX
      d.lastT = now
      panel.style.transform = `translate3d(${d.dx}px,0,0)`
    }
  }
  const onHistoryTouchEnd = () => {
    const d = historyDragRef.current
    historyDragRef.current = null
    const panel = historyPanelRef.current
    if (!d?.claimed || !panel) return
    const dismiss = d.dx > 90 || d.vx > 0.5
    panel.style.transition = "transform 300ms cubic-bezier(0.2, 0.7, 0.2, 1)"
    panel.style.transform = dismiss
      ? "translate3d(105%,0,0)"
      : "translate3d(0,0,0)"
    window.setTimeout(() => {
      if (historyPanelRef.current) historyPanelRef.current.style.transform = ""
    }, 320)
    if (dismiss) setHistoryOpen(false)
  }
  const confirm = useConfirm()
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions())
  const [activeId, setActiveId] = useState<string>(
    () => loadSessions()[0]?.id ?? ""
  )
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const configured = isAiConfigured(settings)
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  )
  const messages = activeSession?.messages ?? []

  const persistSessions = (next: ChatSession[]) => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(next))
    } catch {
      /* quota */
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, loading])

  // ФУНКЦИОНАЛЬНОЕ обновление: prev — всегда актуальный стейт. Обычное замыкание
  // на `sessions` внутри одного send() дважды патчит сессию, и второй патч,
  // прочитав устаревший массив, затирал сообщение пользователя — поэтому
  // «промты не сохранялись», а заголовок оставался «Атаусыз чат».
  const patchSession = (id: string, patch: (s: ChatSession) => ChatSession) => {
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? patch(s) : s))
      persistSessions(next)
      return next
    })
  }

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || loading || !configured) return
    const userMsg: ChatMessage = { role: "user", text }

    let sessionId = activeSession?.id ?? ""
    if (!activeSession) {
      sessionId = newId()
      const fresh: ChatSession = {
        id: sessionId,
        title: text.slice(0, 42),
        updatedAt: new Date().toISOString(),
        messages: [userMsg],
      }
      setSessions((prev) => {
        const next = [fresh, ...prev].slice(0, MAX_SESSIONS)
        persistSessions(next)
        return next
      })
      setActiveId(sessionId)
    } else {
      patchSession(sessionId, (s) => ({
        ...s,
        title: s.messages.length === 0 ? text.slice(0, 42) : s.title,
        messages: [...s.messages, userMsg],
        updatedAt: new Date().toISOString(),
      }))
    }
    const history = [...(activeSession?.messages ?? []), userMsg]
    setInput("")
    setLoading(true)

    try {
      const context = buildAdvisorContext({
        activeCourse,
        activeSemester,
        canvasCourses,
        canvasAssignments,
        platonusYears,
        subjects,
        calendar,
        schedule,
      })
      const chatHistory = history
        .slice(-8)
        .map((m) => `${m.role === "user" ? "Студент" : "Советник"}: ${m.text}`)
        .join("\n")
      const result = await chatComplete(
        settings,
        SYSTEM_PROMPT + "\n\n## Данные студента:\n" + context,
        chatHistory + "\nСтудент: " + text
      )
      patchSession(sessionId, (s) => ({
        ...s,
        messages: [...s.messages, { role: "assistant", text: result }],
        updatedAt: new Date().toISOString(),
      }))
    } catch (err) {
      patchSession(sessionId, (s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            role: "assistant",
            text: "⚠ " + (err instanceof Error ? err.message : String(err)),
          },
        ],
      }))
    } finally {
      setLoading(false)
      // Вернуть фокус в поле ввода только на десктопе — на телефоне выскочившая
      // клавиатура закрывает половину экрана, и ответ не прочитать.
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        inputRef.current?.focus()
      }
    }
  }

  const newChat = () => {
    if (activeSession && activeSession.messages.length === 0) {
      setHistoryOpen(false)
      return
    }
    const session: ChatSession = {
      id: newId(),
      title: kk.chatUntitled,
      updatedAt: new Date().toISOString(),
      messages: [],
    }
    persistSessions([session, ...sessions].slice(0, MAX_SESSIONS))
    setActiveId(session.id)
    setHistoryOpen(false)
  }

  const deleteSession = async (id: string) => {
    const ok = await confirm({ title: kk.chatDelete + "?", destructive: true })
    if (!ok) return
    const next = sessions.filter((s) => s.id !== id)
    persistSessions(next)
    if (activeId === id) setActiveId(next[0]?.id ?? "")
  }

  const clearAllSessions = async () => {
    const ok = await confirm({
      title: kk.chatClearAllConfirm,
      destructive: true,
    })
    if (!ok) return
    persistSessions([])
    setActiveId("")
    setHistoryOpen(false)
  }

  const handleSettingsSave = (newSettings: AiSettings) => {
    setSettings(newSettings)
    saveAiSettings(newSettings)
    setSettingsOpen(false)
  }

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] min-w-0 flex-col space-y-3 lg:h-[calc(100dvh-8.5rem)]">
      {/* Top Header */}
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Sparkles className="size-4" /> AI
          </p>
          <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight sm:text-3xl">
            {kk.advisorTitle}
          </h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {kk.advisorSubtitle}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Badge
            variant={configured ? "emerald" : "rose"}
            className="hidden px-1.5 py-0 text-[10px] md:inline-flex"
          >
            {configured ? kk.aiConnected : kk.aiNotConfigured}
          </Badge>

          {/* History drawer trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
            className="h-8 gap-1.5 rounded-lg px-2.5 text-xs sm:px-3"
            title={kk.chatHistory}
          >
            <History className="size-3.5 text-primary" />
            <span className="hidden sm:inline">{kk.chatHistory}</span>
            {sessions.length > 0 && (
              <span className="py-0.2 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary tabular-nums">
                {sessions.length}
              </span>
            )}
          </Button>

          {/* New chat button */}
          <Button
            variant="outline"
            size="sm"
            onClick={newChat}
            className="h-8 gap-1 rounded-lg px-2.5 text-xs sm:px-3"
            title={kk.chatNew}
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">{kk.chatNew}</span>
          </Button>

          {/* Settings button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="size-8 rounded-lg p-0"
            title={kk.aiSettings}
          >
            <Settings2 className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      {/* Messages area or Prompt suggestions */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
      >
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full min-h-[220px] w-full max-w-lg flex-col items-center justify-center px-2 py-4 text-center">
            <div className="mb-2.5 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-5.5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground sm:text-base">
              {kk.aiAskTitle}
            </h3>
            <p className="mt-1 mb-3.5 max-w-xs text-xs text-muted-foreground">
              {kk.chatEmptyHistoryDesc}
            </p>

            <div className="grid w-full gap-2 text-left">
              {[kk.aiExample1, kk.aiExample2, kk.aiExample3].map((ex, idx) => {
                const cleanText = ex.replace(/^[«"]|[»"]$/g, "")
                return (
                  <button
                    key={idx}
                    onClick={() => void send(cleanText)}
                    className="group flex items-center justify-between rounded-xl border border-border/80 bg-card p-3 text-left text-xs text-muted-foreground shadow-2xs transition-all hover:border-primary/50 hover:bg-muted/40 hover:text-foreground"
                  >
                    <span className="flex-1 pr-2 leading-relaxed">
                      «{cleanText}»
                    </span>
                    <Send className="size-3.5 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`chat-in flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={cn(
                  "space-y-1 rounded-2xl px-4 py-2.5 leading-relaxed shadow-2xs",
                  msg.role === "user"
                    ? "max-w-[85%] rounded-tr-xs bg-primary text-xs font-medium text-primary-foreground sm:max-w-[75%] sm:text-sm"
                    : "max-w-[92%] rounded-tl-xs border border-border/80 bg-card text-xs text-foreground sm:max-w-[85%] sm:text-sm"
                )}
              >
                <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase opacity-70">
                  {msg.role === "user" ? (
                    <span>{kk.youLabel}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-primary">
                      <Sparkles className="size-3" />
                      AI
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 text-xs leading-relaxed sm:text-sm">
                  {msg.text.split("\n").map((line, j) => {
                    if (!line.trim()) return <div key={j} className="h-1" />
                    if (/^[-•]\s/.test(line.trim())) {
                      return (
                        <p key={j} className="flex gap-1.5">
                          <span className="shrink-0 text-primary">•</span>
                          <span>
                            {renderBold(line.trim().replace(/^[-•]\s/, ""))}
                          </span>
                        </p>
                      )
                    }
                    if (/^\d+[.)]\s/.test(line.trim())) {
                      return <p key={j}>{renderBold(line.trim())}</p>
                    }
                    return <p key={j}>{renderBold(line)}</p>
                  })}
                </div>
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="chat-in flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-border/80 bg-card px-4 py-2.5 shadow-2xs">
              <Sparkles className="size-3.5 animate-spin text-primary" />
              <p className="animate-pulse text-xs text-muted-foreground">
                {kk.aiThinking}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="flex shrink-0 gap-2 border-t border-border/70 pt-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder={configured ? kk.aiPlaceholder : kk.aiPlaceholderSetup}
          disabled={!configured}
          className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm shadow-2xs focus:ring-2 focus:ring-primary/40 focus:outline-none disabled:opacity-50"
        />
        <Button
          onClick={() => void send()}
          disabled={!configured || loading || !input.trim()}
          className="shrink-0 rounded-xl px-4"
        >
          <Send className="size-4" />
        </Button>
      </div>

      {/* Chat History Slide-Over Drawer — портал в body: обёртка страницы
          (.page-enter) на маунте 300мс держит transform, и fixed-панель внутри
          неё позиционируется по колонке контента — отсюда «мигание» шторки */}
      {createPortal(
        <div
          className={cn(
            "fixed inset-0 z-50 transition-opacity",
            !historyOpen && "pointer-events-none"
          )}
          aria-hidden={!historyOpen}
          inert={!historyOpen}
        >
          {/* Backdrop */}
          <div
            className={cn(
              "absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity duration-300",
              historyOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={() => setHistoryOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div
            ref={historyPanelRef}
            onTouchStart={onHistoryTouchStart}
            onTouchMove={onHistoryTouchMove}
            onTouchEnd={onHistoryTouchEnd}
            onTouchCancel={onHistoryTouchEnd}
            className={cn(
              "absolute inset-y-0 right-0 z-10 flex w-full max-w-sm flex-col border-l border-border/80 bg-card shadow-2xl transition-transform duration-300 ease-out sm:max-w-md",
              historyOpen ? "translate-x-0" : "translate-x-full"
            )}
            role="dialog"
            aria-label={kk.chatHistory}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <History className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold tracking-tight">
                      {kk.chatHistory}
                    </h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {sessions.length}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={kk.cancel}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* New Chat action */}
            <div className="border-b border-border/50 p-3">
              <Button
                onClick={newChat}
                className="w-full justify-center gap-2 text-xs font-semibold shadow-xs"
                size="sm"
              >
                <Plus className="size-4" />
                {kk.chatNew}
              </Button>
            </div>

            {/* List of sessions */}
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                    <MessageSquareDashed className="size-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {kk.chatEmptyHistory}
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    {kk.chatEmptyHistoryDesc}
                  </p>
                </div>
              ) : (
                sessions.map((s) => {
                  const isActive = s.id === activeId
                  const lastMsg = s.messages[s.messages.length - 1]
                  const count = s.messages.length
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setActiveId(s.id)
                        setHistoryOpen(false)
                      }}
                      className={cn(
                        "group relative cursor-pointer rounded-xl border p-3 text-left transition-all select-none",
                        isActive
                          ? "border-primary/60 bg-primary/5 shadow-xs ring-1 ring-primary/20"
                          : "border-border/60 bg-card/60 hover:border-border hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <MessageSquare
                            className={cn(
                              "size-3.5 shrink-0",
                              isActive
                                ? "text-primary"
                                : "text-muted-foreground"
                            )}
                          />
                          <p
                            className={cn(
                              "truncate text-xs font-semibold",
                              isActive ? "text-primary" : "text-foreground"
                            )}
                            title={s.title}
                          >
                            {s.title}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSession(s.id)
                          }}
                          className="-mt-0.5 -mr-1 rounded-md p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive max-sm:opacity-70 sm:opacity-0"
                          title={kk.chatDelete}
                          aria-label={kk.chatDelete}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="max-w-[180px] truncate text-[11px] opacity-80">
                          {lastMsg
                            ? (lastMsg.role === "user" ? "Вы: " : "AI: ") +
                              lastMsg.text.replace(/\s+/g, " ")
                            : kk.chatUntitled}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
                          <span>{kk.chatMessagesCount(count)}</span>
                          <span>•</span>
                          <span>{formatChatDate(s.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer with Clear All */}
            {sessions.length > 0 && (
              <div className="flex items-center justify-between border-t border-border/70 bg-card/50 p-3 text-xs">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {sessions.length} / {MAX_SESSIONS}
                </span>
                <button
                  onClick={clearAllSessions}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                  {kk.chatClearAll}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <AiSettingsModal
          settings={settings}
          onSave={handleSettingsSave}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

function AiSettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: AiSettings
  onSave: (s: AiSettings) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(settings)

  return (
    <Modal isOpen onClose={onClose} title={kk.aiSettings} className="max-w-lg">
      <div className="space-y-3">
        <label className="block space-y-1 text-xs font-medium">
          {kk.aiProvider}
          <select
            value={draft.provider}
            onChange={(e) =>
              setDraft({
                ...draft,
                provider: e.target.value as AiSettings["provider"],
              })
            }
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="openai-compat">{kk.aiProviderOpenaiCompat}</option>
            <option value="google-gemini">Google AI Studio — Gemini</option>
          </select>
        </label>

        {draft.provider === "openai-compat" ? (
          <>
            <label className="block space-y-1 text-xs font-medium">
              Base URL
              <input
                value={draft.openai.baseUrl}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    openai: { ...draft.openai, baseUrl: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="block space-y-1 text-xs font-medium">
              API Key
              <input
                type="password"
                value={draft.openai.apiKey}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    openai: { ...draft.openai, apiKey: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="block space-y-1 text-xs font-medium">
              Model
              <input
                value={draft.openai.model}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    openai: { ...draft.openai, model: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
              />
            </label>
          </>
        ) : (
          <>
            <label className="block space-y-1 text-xs font-medium">
              API Key (aistudio.google.com)
              <input
                type="password"
                value={draft.gemini.apiKey}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    gemini: { ...draft.gemini, apiKey: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="block space-y-1 text-xs font-medium">
              {kk.aiModelHint}
              <input
                value={draft.gemini.model}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    gemini: { ...draft.gemini, model: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
              />
            </label>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" size="sm" onClick={onClose}>
          {kk.cancel}
        </Button>
        <Button size="sm" onClick={() => onSave(draft)}>
          {kk.save}
        </Button>
      </div>
    </Modal>
  )
}
