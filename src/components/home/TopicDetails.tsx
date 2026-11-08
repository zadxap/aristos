import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, BookOpen } from 'lucide-react'
import { copyText } from '@/lib/clipboard'
import { kk } from '@/i18n'

export function TopicDetails({ subject, topic, subjectId }: { subject: string; topic: string; subjectId?: string }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const copyTopic = async () => {
    try {
      await copyText(`${subject}\n${topic}`)
      setCopied(true)
      setCopyFailed(false)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopyFailed(true)
      window.setTimeout(() => setCopyFailed(false), 2200)
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={`${expanded ? kk.showLess : kk.showFull}: ${subject}`}
        onClick={() => setExpanded((value) => !value)}
        className="mt-1 block w-full min-w-0 rounded-md text-left text-xs leading-relaxed text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
      >
        <span className={expanded ? 'break-words' : 'line-clamp-2 break-words'}>
          <span className="font-medium text-foreground/80">{kk.topicLabel}</span>
          {topic}
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex min-h-8 items-center justify-end gap-2 pt-1">
            <div className="mr-auto flex items-center gap-3">
              {subjectId && <Link to={`/subjects/${subjectId}`} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"><BookOpen className="size-3.5" />{kk.subjectPage}</Link>}
              {copyFailed && <span role="status" className="text-[11px] text-muted-foreground">{kk.copyFailed}</span>}
              {copied && <span role="status" className="text-[11px] text-muted-foreground">{kk.copied}</span>}
            </div>
            <button
              type="button"
              onClick={copyTopic}
              aria-label={kk.copyAria}
              className="inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              <span>{copied ? kk.copied : kk.copy}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
