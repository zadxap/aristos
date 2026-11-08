/**
 * Файловые вложения для AI-панели: PDF и картинки уходят в модель как base64,
 * TXT — как текст. Лимит суммарного размера — защита от больших сканов.
 */

import { t } from './i18n';

export type AttachmentKind = 'pdf' | 'txt' | 'image';

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  kind: AttachmentKind;
  /** MIME-тип: application/pdf | text/plain | image/png | image/jpeg | image/webp */
  mime: string;
  /** base64 без data:-префикса (для PDF и изображений) */
  base64?: string;
  /** декодированное содержимое (только для TXT) */
  text?: string;
}

export const MAX_TOTAL_FILE_BYTES = 15 * 1024 * 1024;
export const FILE_INPUT_ACCEPT = '.pdf,.txt,.png,.jpg,.jpeg,.webp';

export function newAttachmentId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function detectFile(file: File): { kind: AttachmentKind; mime: string } | null {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (name.endsWith('.pdf') || type === 'application/pdf') return { kind: 'pdf', mime: 'application/pdf' };
  if (name.endsWith('.txt') || type === 'text/plain') return { kind: 'txt', mime: 'text/plain' };
  if (name.endsWith('.png') || type === 'image/png') return { kind: 'image', mime: 'image/png' };
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || type === 'image/jpeg') {
    return { kind: 'image', mime: 'image/jpeg' };
  }
  if (name.endsWith('.webp') || type === 'image/webp') return { kind: 'image', mime: 'image/webp' };
  return null;
}

/** Короткая подпись типа на чипе. */
export function attachmentBadge(kind: AttachmentKind): string {
  switch (kind) {
    case 'pdf':
      return 'PDF';
    case 'txt':
      return 'TXT';
    case 'image':
      return 'IMG';
  }
}

/** Иконка типа на чипе. */
export function attachmentIcon(kind: AttachmentKind): string {
  switch (kind) {
    case 'pdf':
      return '📄';
    case 'txt':
      return '📃';
    case 'image':
      return '🖼️';
  }
}

/** base64-содержимое файла без префикса "data:...;base64," */
export function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error(t().aiErrors.fileReadFailed(file.name)));
    reader.readAsDataURL(file);
  });
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error(t().aiErrors.fileReadFailed(file.name)));
    reader.readAsText(file);
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(2)} МБ`;
}
