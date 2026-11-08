import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { kk } from "@/i18n"
import { formatRemainingMinutes } from "@/lib/status"
import type { CurrentStatus } from "@/types"
import { TopicDetails } from "./TopicDetails"
import {
  Clock,
  MapPin,
  User,
  Coffee,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  Sunrise,
} from "lucide-react"

interface StatusCardProps {
  status: CurrentStatus
}

export function StatusCard({ status }: StatusCardProps) {
  // Helper for badge variant based on type
  const getBadgeVariant = (type: string | null | undefined) => {
    if (!type) return "secondary"
    const t = type.toLowerCase()
    if (t.includes("lecture") || t.includes("дәріс")) return "blue"
    if (t.includes("practice") || t.includes("практика")) return "emerald"
    if (t.includes("lab") || t.includes("зертхана")) return "purple"
    if (t.includes("srsp") || t.includes("обөж")) return "amber"
    if (t.includes("srs") || t.includes("бөж")) return "rose"
    return "secondary"
  }

  const getLessonTypeLabel = (type: string | null | undefined) => {
    if (!type) return kk.lesson
    const t = type.toLowerCase()
    return (kk.lessonTypes as Record<string, string>)[t] || type
  }

  // 1. In class
  if (status.type === "in_class" && status.entry) {
    const progressPercent = Math.round((status.progress || 0) * 100)

    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant={getBadgeVariant(status.entry.type)}>
                {getLessonTypeLabel(status.entry.type)}
              </Badge>
              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                </span>
                {kk.statusInClass}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs font-semibold text-foreground/80">
              <Clock className="size-3" />
              <span>
                {status.entry.start} - {status.entry.end}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-base leading-snug font-bold text-foreground sm:text-lg">
              {status.entry.subject_name}
            </h3>
            {status.topic && (
              <TopicDetails
                subject={status.entry.subject_name}
                topic={status.topic}
                subjectId={status.entry.subject_id}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
            {status.entry.room && (
              <div className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1">
                <MapPin className="size-3 text-primary" />
                <span>{status.entry.room}</span>
              </div>
            )}
            {status.entry.teacher && (
              <div className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1">
                <User className="size-3 text-primary" />
                <span>{status.entry.teacher}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5 border-t border-border/40 pt-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">
                {formatRemainingMinutes(status.minutesLeft ?? 0)}{" "}
                {kk.minutesLeft}
              </span>
              <span className="font-semibold text-primary">
                {progressPercent}%
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // 2. Before the first lesson of the day (morning / night before classes)
  if (status.type === "before_start" && status.nextEntry) {
    const timeLeft = formatRemainingMinutes(status.minutesUntilNext ?? 0)

    return (
      <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 via-card to-card shadow-sm">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="blue" className="gap-1">
                <Sunrise className="size-3" />
                {kk.beforeStart}
              </Badge>
            </div>
            <div className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              {timeLeft}
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {kk.upcomingLesson}:
            </span>
            <h3 className="mt-0.5 text-base font-bold text-foreground">
              {status.nextEntry.subject_name}
            </h3>
            {status.topic && (
              <TopicDetails
                subject={status.nextEntry.subject_name}
                topic={status.topic}
                subjectId={status.nextEntry.subject_id}
              />
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">
              {status.nextEntry.start} - {status.nextEntry.end}
            </span>
            {status.nextEntry.room && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {status.nextEntry.room}
              </span>
            )}
            {status.nextEntry.teacher && (
              <span className="flex items-center gap-1">
                <User className="size-3" /> {status.nextEntry.teacher}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 2b. Break between lessons
  if (status.type === "break" && status.nextEntry) {
    return (
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-card to-card shadow-sm">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="amber" className="gap-1">
                <Coffee className="size-3" />
                {kk.breakTime}
              </Badge>
            </div>
            <div className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              {formatRemainingMinutes(status.minutesUntilNext ?? 0)}{" "}
              {kk.minutesLeft}
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {kk.upcomingLesson}:
            </span>
            <h3 className="mt-0.5 text-base font-bold text-foreground">
              {status.nextEntry.subject_name}
            </h3>
            {status.topic && (
              <TopicDetails
                subject={status.nextEntry.subject_name}
                topic={status.topic}
                subjectId={status.nextEntry.subject_id}
              />
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground/80">
              {status.nextEntry.start} - {status.nextEntry.end}
            </span>
            {status.nextEntry.room && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {status.nextEntry.room}
              </span>
            )}
            {status.nextEntry.teacher && (
              <span className="flex items-center gap-1">
                <User className="size-3" /> {status.nextEntry.teacher}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // 3. Holiday / Exam / Day ended / Free day
  let icon = <CheckCircle2 className="size-6 text-primary" />
  let title = status.label
  let desc = status.sublabel || ""

  if (status.type === "holiday") {
    icon = <Sparkles className="size-6 text-amber-500" />
    title = status.periodName || kk.holiday
    desc = kk.holidayDesc
  } else if (status.type === "exam") {
    icon = <CalendarDays className="size-6 text-rose-500" />
    title = kk.exam
    desc = kk.examDesc
  } else if (status.type === "day_ended") {
    icon = <CheckCircle2 className="size-6 text-emerald-500" />
    title = kk.dayEnded
    desc = kk.dayEndedDesc
  } else if (status.type === "free_day") {
    icon = <Coffee className="size-6 text-primary" />
    title = kk.freeDay
    desc = kk.freeDayDesc
  }

  return (
    <Card className="mb-5 border-border/70 bg-muted/30">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-card shadow-xs">
          {icon}
        </div>
        <div>
          <h3 className="text-base leading-snug font-semibold text-foreground">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        </div>
      </CardContent>
    </Card>
  )
}
