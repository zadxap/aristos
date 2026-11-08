import type { ReactNode } from 'react';
import { t } from '../lib/i18n';

/** Мелкие переиспользуемые строительные блоки форм. */

interface SectionProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Section({ title, subtitle, action, children }: SectionProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">
          {title}
          {subtitle !== undefined && <span className="panel-subtitle mono">{subtitle}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

interface GroupCardProps {
  open: boolean;
  onToggle: () => void;
  title: string;
  titleTitle?: string;
  count: number;
  /** Кнопки в шапке (добавить/очистить) — клики по ним не сворачивают группу. */
  actions?: ReactNode;
  children: ReactNode;
}

/** Коллапсируемая карточка-секция: день кесте, группа тем и т.п. */
export function GroupCard({ open, onToggle, title, titleTitle, count, actions, children }: GroupCardProps) {
  return (
    <section className={'group-card' + (open ? ' open' : '')}>
      <div
        className="group-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <span className="group-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
        <span className="group-title" title={titleTitle}>
          {title}
        </span>
        <span className="badge">{count}</span>
        {actions !== undefined && (
          <span
            className="group-actions"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions}
          </span>
        )}
      </div>
      {open && <div className="group-body">{children}</div>}
    </section>
  );
}

interface FieldHeadProps {
  /** Человеческий ярлык («Название предмета»). */
  label: string;
  /** JSON-ключ мелким моно-шрифтом рядом с ярлыком (не переводится). */
  keyName?: string;
  /** Однострочное объяснение простым языком — под ярлыком. */
  hint?: string;
  optional?: boolean;
}

/** Шапка поля: человеческий ярлык + моно-ключ + объяснение под ними. */
export function FieldHead({ label, keyName, hint, optional }: FieldHeadProps) {
  return (
    <>
      <span className="field-label">
        <span className="field-name">{label}</span>
        {keyName !== undefined && <span className="field-key mono">{keyName}</span>}
        {optional && <em className="field-opt">{t().common.optionalMark}</em>}
      </span>
      {hint !== undefined && <span className="field-hint">{hint}</span>}
    </>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'date' | 'time' | 'email';
  mono?: boolean;
  optional?: boolean;
  list?: string;
  wide?: boolean;
  keyName?: string;
  hint?: string;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  mono = false,
  optional = false,
  list,
  wide = false,
  keyName,
  hint,
}: TextFieldProps) {
  return (
    <label className={'field' + (wide ? ' field-wide' : '')}>
      <FieldHead label={label} keyName={keyName} hint={hint} optional={optional} />
      <input
        type={type}
        value={value}
        list={list}
        placeholder={placeholder}
        className={mono ? 'mono' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  keyName?: string;
  hint?: string;
}

export function TextAreaField({ label, value, onChange, placeholder, rows = 3, keyName, hint }: TextAreaFieldProps) {
  return (
    <label className="field field-wide">
      <FieldHead label={label} keyName={keyName} hint={hint} />
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  optional?: boolean;
  keyName?: string;
  hint?: string;
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  optional = false,
  keyName,
  hint,
}: NumberFieldProps) {
  return (
    <label className="field">
      <FieldHead label={label} keyName={keyName} hint={hint} optional={optional} />
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(0);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}
