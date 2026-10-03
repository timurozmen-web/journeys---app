// Shared building blocks. Screens compose these instead of styling each
// element inline, so the look lives in one place: the classes are in
// src/styles/components.css and every value in src/styles/tokens.css.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackIcon } from './Icons';
import { dayMonth } from '../lib/format';

// Back arrow + title at the top of every pushed screen.
export function ScreenHeader({ title, right, onBack }: { title: ReactNode; right?: ReactNode; onBack?: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="head screenhead">
      <button className="back" aria-label="Back" onClick={onBack ?? (() => navigate(-1))}>
        <BackIcon size={20} color="currentColor" />
      </button>
      <div className="title">{title}</div>
      {right && <div className="right">{right}</div>}
    </div>
  );
}

// Short explanatory paragraph directly under a ScreenHeader.
export function ScreenIntro({ children }: { children: ReactNode }) {
  return <p className="screenintro">{children}</p>;
}

// Label + control (+ optional hint) for a form field. The control itself
// takes className="input" (or "input compact").
export function Field({ label, hint, children, style }: { label: ReactNode; hint?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={style}>
      <label className="field-label">{label}</label>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

// Two fields side by side.
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>;
}

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'onphoto';

export function Button({
  variant = 'primary', block, small, className, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; block?: boolean; small?: boolean }) {
  const cls = ['btn', variant, block && 'block', small && 'small', className].filter(Boolean).join(' ');
  return <button className={cls} {...rest} />;
}

// Small uppercase heading above a group of content.
export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="sectionlabel" style={style}>{children}</div>;
}

export function ErrorText({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="errortext" style={style}>{children}</div>;
}

export function EmptyState({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="emptystate" style={style}>{children}</div>;
}

// One row of mutually exclusive options, either as tabs in a track or
// as separate pills. `tone` picks how the selected option is marked:
// dark fill, soft grey, or brand blue.
export function Segmented<T extends string>({
  options, value, onChange, tone = 'dark', variant = 'track', style,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  tone?: 'dark' | 'soft' | 'brand';
  variant?: 'track' | 'pills';
  style?: CSSProperties;
}) {
  return (
    <div className={`segmented ${tone} ${variant}`} style={style}>
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? 'on' : undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// An image with a readability scrim and content laid over it. `fallback`
// renders when there's no photo (e.g. the generated HeroScene).
export function PhotoHero({
  src, alt = '', fallback, scrim = 'bottom', height, rounded, onClick, style, children,
}: {
  src?: string | null;
  alt?: string;
  fallback?: ReactNode;
  scrim?: 'bottom' | 'full' | 'dissolve' | 'none';
  height: number | string;
  rounded?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const cls = ['photohero', scrim !== 'none' && `scrim-${scrim}`, rounded && 'rounded'].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      style={{ height, cursor: onClick ? 'pointer' : undefined, ...style }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="ph-media">{src ? <img src={src} alt={alt} /> : fallback}</div>
      <div className="ph-scrim" />
      <div className="ph-content">{children}</div>
    </div>
  );
}

// Small glass badge on a photo ("Current trip · Day 3 of 8"). The alert
// tone is a solid brand-blue badge for something that needs attention.
export function Eyebrow({ children, tone }: { children: ReactNode; tone?: 'alert' }) {
  return <span className={tone === 'alert' ? 'ph-eyebrow alert' : 'ph-eyebrow'}>{children}</span>;
}

// Gold day-over-month date for itinerary rows. Plain text, deliberately
// not in a box or circle -- the colour alone marks it out.
export function DateStack({ date }: { date: string | null }) {
  if (!date) return <span className="datestack" aria-hidden="true" />;
  const { day, month } = dayMonth(date);
  return (
    <span className="datestack">
      <span className="ds-day">{day}</span>
      <span className="ds-month">{month}</span>
    </span>
  );
}

// A full-width tappable row with an icon: a choice on a menu-style screen.
export function OptionRow({ icon, label, onClick }: { icon: ReactNode; label: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="optionrow" onClick={onClick}>
      <span className="optionrow-icon">{icon}</span>
      <span className="optionrow-label">{label}</span>
    </button>
  );
}
