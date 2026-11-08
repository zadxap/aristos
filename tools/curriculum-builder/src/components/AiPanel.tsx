import { useEffect, useRef, useState } from 'react';
import type { AcadCalendarDoc, ScheduleDoc, SubjectDoc } from '../types';
import {
  AI_PROVIDER_OPTIONS,
  GEMINI_DEFAULT_MODEL,
  GEMINI_MODEL_PRESETS,
  OPENAI_MODEL_PRESETS,
  extractJson,
  requestCompletion,
  resolveAiSettings,
} from '../lib/ai';
import type { AiProvider, AiSettings } from '../lib/ai';
import { loadAiSettings, saveAiSettings } from '../lib/storage';
import { t } from '../lib/i18n';
import { parseAcadCalendar, parseSchedule, parseSubject } from '../lib/parse';
import { buildFullPrompt } from '../lib/prompt';
import type { AiTarget } from '../lib/prompt';
import {
  FILE_INPUT_ACCEPT,
  MAX_TOTAL_FILE_BYTES,
  attachmentBadge,
  attachmentIcon,
  detectFile,
  formatBytes,
  newAttachmentId,
  readFileBase64,
  readFileText,
} from '../lib/attachments';
import type { AttachedFile } from '../lib/attachments';
import { copyToClipboard } from '../lib/download';
import { Section, TextField } from './bits';

export interface AiApplyHandlers {
  subject: (doc: SubjectDoc) => void;
  schedule: (doc: ScheduleDoc) => void;
  calendar: (doc: AcadCalendarDoc) => void;
}

interface Props {
  activeTab: AiTarget;
  onApply: AiApplyHandlers;
}

interface Status {
  kind: 'ok' | 'error';
  text: string;
}

export default function AiPanel({ activeTab, onApply }: Props) {
  const [settings, setSettings] = useState<AiSettings>(() => resolveAiSettings(loadAiSettings()));
  const [target, setTarget] = useState<AiTarget>(activeTab);
  const [source, setSource] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [rawReply, setRawReply] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveAiSettings(settings);
  }, [settings]);

  // По умолчанию генерируем документ активной вкладки.
  useEffect(() => {
    setTarget(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!copiedPrompt) return;
    const timer = window.setTimeout(() => setCopiedPrompt(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copiedPrompt]);

  const fullPrompt = buildFullPrompt(target, source);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  async function handleFilesChosen(list: FileList | null): Promise<void> {
    if (list === null || list.length === 0) return;
    const picked = Array.from(list);
    const rejected = picked.filter((f) => detectFile(f) === null);
    const accepted = picked.filter((f) => detectFile(f) !== null);

    const currentTotal = files.reduce((sum, f) => sum + f.size, 0);
    const incomingTotal = accepted.reduce((sum, f) => sum + f.size, 0);
    if (currentTotal + incomingTotal > MAX_TOTAL_FILE_BYTES) {
      setFileError(
        t().ai.sizeLimitError(
          formatBytes(MAX_TOTAL_FILE_BYTES),
          formatBytes(currentTotal),
          formatBytes(incomingTotal),
        ),
      );
      return;
    }

    if (rejected.length > 0) {
      setFileError(t().ai.rejectedFilesError(rejected.map((f) => f.name).join(', ')));
    } else {
      setFileError(null);
    }

    const read: AttachedFile[] = [];
    for (const file of accepted) {
      const detected = detectFile(file);
      if (detected === null) continue;
      try {
        if (detected.kind === 'txt') {
          read.push({
            id: newAttachmentId(),
            name: file.name,
            size: file.size,
            kind: 'txt',
            mime: detected.mime,
            text: await readFileText(file),
          });
        } else {
          // PDF и картинки — base64 (картинки уходят как inline_data / image_url)
          read.push({
            id: newAttachmentId(),
            name: file.name,
            size: file.size,
            kind: detected.kind,
            mime: detected.mime,
            base64: await readFileBase64(file),
          });
        }
      } catch (e) {
        setFileError(e instanceof Error ? e.message : String(e));
      }
    }
    if (read.length > 0) setFiles((prev) => [...prev, ...read]);
  }

  function removeFile(id: string): void {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setFileError(null);
  }

  async function handleGenerate(): Promise<void> {
    if (source.trim() === '' && files.length === 0) {
      setStatus({ kind: 'error', text: t().ai.needSource });
      return;
    }
    setBusy(true);
    setStatus(null);
    setRawReply(null);
    try {
      const content = await requestCompletion(settings, target, source, files);
      setRawReply(content);
      const json = extractJson(content);

      const errors: string[] = [];
      if (target === 'subject') {
        const r = parseSubject(json);
        if (r.ok) onApply.subject(r.doc);
        else errors.push(...r.errors);
      } else if (target === 'schedule') {
        const r = parseSchedule(json);
        if (r.ok) onApply.schedule(r.doc);
        else errors.push(...r.errors);
      } else {
        const r = parseAcadCalendar(json);
        if (r.ok) onApply.calendar(r.doc);
        else errors.push(...r.errors);
      }

      if (errors.length > 0) {
        setStatus({
          kind: 'error',
          text: t().ai.schemaMismatch(t().ai.targetShort[target], errors.map((e) => '• ' + e).join('\n')),
        });
      } else {
        setStatus({
          kind: 'ok',
          text: t().ai.generated(t().ai.targetShort[target]),
        });
      }
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyPrompt(): Promise<void> {
    const ok = await copyToClipboard(fullPrompt);
    setCopiedPrompt(ok);
    if (!ok) {
      setStatus({
        kind: 'error',
        text: t().ai.copyPromptFailed,
      });
    }
  }

  const tr = t().ai;

  return (
    <Section title={tr.title} subtitle={tr.subtitle}>
      <div className="field">
        <span className="field-label">{tr.provider}</span>
        <select
          value={settings.provider}
          onChange={(e) => setSettings({ ...settings, provider: e.target.value as AiProvider })}
        >
          {AI_PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {settings.provider === 'openai-compat' ? (
        <>
          <div className="fields">
            <TextField
              label="Base URL"
              mono
              wide
              value={settings.openai.baseUrl}
              onChange={(v) => setSettings({ ...settings, openai: { ...settings.openai, baseUrl: v } })}
              placeholder="https://api.openai.com/v1"
            />
            <TextField
              label="API key"
              mono
              wide
              value={settings.openai.apiKey}
              onChange={(v) => setSettings({ ...settings, openai: { ...settings.openai, apiKey: v } })}
              placeholder="sk-…"
            />
            <TextField
              label="Model"
              mono
              list="cb-ai-model-presets"
              value={settings.openai.model}
              onChange={(v) => setSettings({ ...settings, openai: { ...settings.openai, model: v } })}
              placeholder="gpt-4o-mini"
            />
          </div>
          <p className="hint">{tr.modelProxyHint}</p>
        </>
      ) : (
        <>
          <div className="fields">
            <TextField
              label="API key (Google AI Studio)"
              mono
              wide
              value={settings.gemini.apiKey}
              onChange={(v) => setSettings({ ...settings, gemini: { ...settings.gemini, apiKey: v } })}
              placeholder="AIza…"
            />
            <TextField
              label="Model"
              mono
              list="cb-ai-model-presets"
              value={settings.gemini.model}
              onChange={(v) => setSettings({ ...settings, gemini: { ...settings.gemini, model: v } })}
              placeholder={GEMINI_DEFAULT_MODEL}
            />
          </div>
          <p className="hint">{tr.flashLiteHint}</p>
        </>
      )}
      <datalist id="cb-ai-model-presets">
        {(settings.provider === 'google-gemini' ? GEMINI_MODEL_PRESETS : OPENAI_MODEL_PRESETS).map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <p className="hint">
        {settings.provider === 'openai-compat'
          ? tr.openaiKeyHint
          : tr.geminiKeyHint(GEMINI_DEFAULT_MODEL)}
      </p>

      <div className="field">
        <span className="field-label">{tr.targetLabel}</span>
        <select value={target} onChange={(e) => setTarget(e.target.value as AiTarget)}>
          {(Object.keys(tr.targetOptions) as AiTarget[]).map((k) => (
            <option key={k} value={k}>
              {tr.targetOptions[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="field-label">{tr.sourceLabel}</span>
        <textarea
          rows={7}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={tr.sourcePlaceholder}
        />
      </div>

      <div className="field">
        <span className="field-label">{tr.filesLabel}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_INPUT_ACCEPT}
          multiple
          className="visually-hidden"
          onChange={(e) => {
            void handleFilesChosen(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="btn-row">
          <button className="btn" onClick={() => fileInputRef.current?.click()}>
            {tr.attachFiles}
          </button>
        </div>
        {files.length > 0 && (
          <ul className="file-chips">
            {files.map((f) => (
              <li key={f.id} className="file-chip">
                <span className="file-chip-icon" aria-hidden="true">{attachmentIcon(f.kind)}</span>
                <span className="file-chip-type mono">{attachmentBadge(f.kind)}</span>
                <span className="file-chip-name">{f.name}</span>
                <span className="file-chip-size mono">{formatBytes(f.size)}</span>
                <button className="btn-icon danger" title={tr.removeFile} onClick={() => removeFile(f.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {files.length > 0 && (
          <p className="hint">
            {tr.filesSummary(files.length, formatBytes(totalBytes), formatBytes(MAX_TOTAL_FILE_BYTES))}
          </p>
        )}
        {fileError !== null && <p className="hint warn">{fileError}</p>}
        <p className="hint">{tr.attachmentsHint}</p>
      </div>

      <div className="btn-row">
        <button className="btn primary" disabled={busy} onClick={() => void handleGenerate()}>
          {busy ? tr.generating : tr.generate}
        </button>
        <button className="btn" disabled={busy} onClick={() => void handleCopyPrompt()}>
          {copiedPrompt ? tr.promptCopied : tr.copyPrompt}
        </button>
      </div>

      {status !== null && <div className={'status ' + (status.kind === 'ok' ? 'ok' : 'bad')}>{status.text}</div>}

      <details className="prompt-box">
        <summary>{tr.fullPromptSummary}</summary>
        <p className="hint">{tr.fullPromptHint}</p>
        <textarea
          className="mono"
          rows={14}
          readOnly
          value={fullPrompt}
          onFocus={(e) => e.currentTarget.select()}
        />
      </details>

      {rawReply !== null && (
        <details className="raw-reply">
          <summary>{tr.rawReplySummary}</summary>
          <pre className="json">{rawReply}</pre>
        </details>
      )}
    </Section>
  );
}
