import { useState } from "react"
import { StickyNote } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { kk } from "@/i18n"

const NOTES_KEY = "aristos-home-notes-v1"

function loadNotes(): string {
  try {
    return localStorage.getItem(NOTES_KEY) ?? ""
  } catch {
    return ""
  }
}

function saveNotes(text: string): void {
  try {
    localStorage.setItem(NOTES_KEY, text)
  } catch {
    /* хранилище недоступно — не критично */
  }
}

/** Заметки пользователя на главной: свободный текст, хранится на устройстве.
 *  Редактируются всегда — это личный контент, а не структура дашборда. */
export function NotesCard() {
  const [text, setText] = useState(loadNotes)

  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="p-4">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
          <StickyNote className="size-4 text-primary" />
          {kk.notesTitle}
        </h3>

        <textarea
          value={text}
          rows={4}
          onChange={(e) => {
            setText(e.target.value)
            saveNotes(e.target.value)
          }}
          onBlur={(e) => saveNotes(e.currentTarget.value)}
          placeholder={kk.notesPlaceholder}
          className="w-full resize-y rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-foreground transition-colors outline-none placeholder:text-muted-foreground focus:border-primary/50"
        />
        {!text.trim() && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {kk.notesEmptyHint}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
