import { useEffect, useState } from 'react';
import { copyToClipboard, downloadText } from '../lib/download';
import { t } from '../lib/i18n';

interface Props {
  filename: string;
  json: string;
  errors: string[];
}

export default function ExportPanel({ filename, json, errors }: Props) {
  const [copied, setCopied] = useState(false);
  const blocked = errors.length > 0;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy(): Promise<void> {
    const ok = await copyToClipboard(json);
    setCopied(ok);
    if (!ok) {
      window.alert(t().export.copyFailedAlert);
    }
  }

  const tr = t().export;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">
          {tr.title} <span className="panel-subtitle mono">{filename}</span>
        </h2>
      </div>
      <div className="btn-row">
        <button className="btn primary" disabled={blocked} onClick={() => downloadText(filename, json)}>
          {tr.download}
        </button>
        <button className="btn" disabled={blocked} onClick={() => void handleCopy()}>
          {copied ? tr.copied : tr.copy}
        </button>
      </div>
      {blocked && <p className="hint warn">{tr.blockedHint}</p>}
      <details>
        <summary>{tr.preview}</summary>
        <pre className="json">{json}</pre>
      </details>
    </section>
  );
}
