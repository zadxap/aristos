import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { kk } from '@/i18n'
import { useAristosDB } from '@/context/DBContext'
import type { CanvasCourseMap } from '@/types'

interface CourseMappingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CourseMappingModal({ isOpen, onClose }: CourseMappingModalProps) {
  const { canvasCourses, canvasCourseMap, subjects, setCourseMapping } = useAristosDB()
  const [draft, setDraft] = useState<CanvasCourseMap>({})
  const [wasOpen, setWasOpen] = useState(false)

  // Refresh the draft each time the modal opens (state adjusted during render, per React docs).
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) setDraft({ ...canvasCourseMap })
  }

  const sortedSubjects = [...subjects].sort((a, b) =>
    a.course - b.course || a.semester - b.semester || a.subject_name.localeCompare(b.subject_name)
  )

  const handleSave = async () => {
    await setCourseMapping(draft)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={kk.canvasMapping}
      description={kk.canvasMappingDescription}
      className="max-w-2xl"
    >
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {canvasCourses.map((course) => {
          const value = draft[String(course.id)] ?? null
          return (
            <div
              key={course.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl border border-border/70 bg-muted/20"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{course.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="blue" className="text-[10px] px-1.5 py-0">{course.code}</Badge>
                  {course.current_score !== null && (
                    <span className="text-[11px] text-muted-foreground">
                      {kk.currentScore}: <span className="font-semibold text-foreground">{course.current_score}%</span>
                      {course.current_grade ? ` · ${course.current_grade}` : ''}
                    </span>
                  )}
                </div>
              </div>
              <select
                value={value ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [String(course.id)]: event.target.value || null }))
                }
                className="sm:w-56 shrink-0 rounded-lg border border-border bg-card px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— {kk.unmapped} —</option>
                {sortedSubjects.map((subject) => (
                  <option key={subject.subject_id} value={subject.subject_id}>
                    {subject.subject_name} ({kk.courseShortN(subject.course)} {kk.semShortN(subject.semester)})
                  </option>
                ))}
              </select>
            </div>
          )
        })}
        {canvasCourses.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">{kk.canvasEmptyTitle}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" size="sm" onClick={onClose}>
          {kk.cancel}
        </Button>
        <Button size="sm" onClick={handleSave}>
          {kk.save}
        </Button>
      </div>
    </Modal>
  )
}
