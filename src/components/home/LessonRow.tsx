import { useState } from 'react'
import type { ScheduleEntry } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { TopicDetails } from './TopicDetails'
import { kk } from '@/i18n'
import { MapPin, User, Trash2, Pencil } from 'lucide-react'

interface LessonRowProps {
  entry: ScheduleEntry
  topic?: string
  /** 'now' — пара идёт сейчас, 'next' — следующая сегодня. */
  highlight?: 'now' | 'next'
  editMode?: boolean
  onDelete?: () => void
  onEdit?: (entry: ScheduleEntry) => void
}

function getBadgeVariant(type: string | null | undefined) {
  if (!type) return 'secondary'
  const t = type.toLowerCase()
  if (t.includes('lecture') || t.includes('дәріс')) return 'blue'
  if (t.includes('practice') || t.includes('практика')) return 'emerald'
  if (t.includes('lab') || t.includes('зертхана')) return 'purple'
  if (t.includes('srsp') || t.includes('обөж')) return 'amber'
  if (t.includes('srs') || t.includes('бөж')) return 'rose'
  return 'secondary'
}

function getLessonTypeLabel(type: string | null | undefined) {
  if (!type) return kk.lesson
  const t = type.toLowerCase()
  return (kk.lessonTypes as Record<string, string>)[t] || type
}

/** One timetable row: time | type | subject | room/teacher | actions. */
export function LessonRow({ entry, topic, highlight, editMode = false, onDelete, onEdit }: LessonRowProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState(entry)

  return (
    <>
      <div
        className={
          'relative flex items-start gap-2 sm:gap-4 px-3 sm:px-4 py-3 transition-colors' +
          (highlight === 'now' ? ' bg-primary/5' : '')
        }
      >
        {/* Accent bar for the lesson currently in progress */}
        {highlight === 'now' && (
          <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
        )}

        {/* Time column */}
        <div
          className={
            'w-14 sm:w-16 shrink-0 text-xs font-bold tabular-nums pt-0.5 ' +
            (highlight === 'now' ? 'text-primary' : 'text-foreground/90')
          }
        >
          {entry.start}
          <span className="block text-[10px] font-medium text-muted-foreground">{entry.end}</span>
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={getBadgeVariant(entry.type)} className="text-[10px] py-0 px-2">
              {getLessonTypeLabel(entry.type)}
            </Badge>
            {highlight === 'now' && (
              <Badge className="text-[10px] py-0 px-2 gap-1.5">
                <span className="size-1.5 rounded-full bg-primary-foreground animate-pulse" aria-hidden="true" />
                {kk.nowBadge}
              </Badge>
            )}
            {highlight === 'next' && (
              <Badge variant="outline" className="text-[10px] py-0 px-2 text-muted-foreground">
                {kk.nextBadge}
              </Badge>
            )}
            {entry.room && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="size-3 text-primary" /> {entry.room}
              </span>
            )}
            {entry.teacher && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <User className="size-3 text-primary" /> {entry.teacher}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{entry.subject_name}</p>
          {topic && (
            <div className="min-w-0 mt-0.5">
              <TopicDetails subject={entry.subject_name} topic={topic} subjectId={entry.subject_id} />
            </div>
          )}
        </div>

        {/* Actions */}
        {editMode && (
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <button
                onClick={() => { setDraft(entry); setEditOpen(true) }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                aria-label={kk.editLessonAria}
                title={kk.edit}
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={kk.deleteLessonAria}
                title={kk.delete}
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {onEdit && (
        <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title={kk.editLesson} description={entry.subject_name}>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); onEdit(draft); setEditOpen(false) }}>
            <label className="block space-y-1 text-xs font-medium">{kk.subjectName}
              <input required value={draft.subject_name} onChange={(event) => setDraft({ ...draft, subject_name: event.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-xs font-medium">{kk.startTime}
                <input type="time" required value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1 text-xs font-medium">{kk.endTime}
                <input type="time" required value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-xs font-medium">{kk.room}
                <input value={draft.room || ''} onChange={(event) => setDraft({ ...draft, room: event.target.value || null })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1 text-xs font-medium">{kk.teacher}
                <input value={draft.teacher || ''} onChange={(event) => setDraft({ ...draft, teacher: event.target.value || null })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>{kk.cancel}</Button>
              <Button type="submit">{kk.save}</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
