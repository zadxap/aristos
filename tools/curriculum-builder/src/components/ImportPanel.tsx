import { useRef } from 'react';
import { t } from '../lib/i18n';

export interface ImportStatus {
  kind: 'ok' | 'error';
  text: string;
}

interface Props {
  onImport: (text: string) => void;
  status: ImportStatus | null;
  tabTitle: string;
}

export default function ImportPanel({ onImport, status, tabTitle }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tr = t().import;

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    const text = await file.text();
    onImport(text);
  }

  return (
    <section className="panel">
      <h2 className="panel-title">{tr.title}</h2>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json,.txt"
        className="visually-hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="btn-row">
        <button className="btn" onClick={() => inputRef.current?.click()}>
          {tr.chooseFile}
        </button>
      </div>
      <p className="hint">{tr.hint(tabTitle)}</p>
      {status !== null && <div className={'status ' + (status.kind === 'ok' ? 'ok' : 'bad')}>{status.text}</div>}
    </section>
  );
}
