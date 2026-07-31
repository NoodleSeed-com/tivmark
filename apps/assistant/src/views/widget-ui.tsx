import {
  useId,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

export type WidgetTheme = 'light' | 'dark';

type WidgetFrameProps = {
  readonly theme: WidgetTheme;
  readonly title: string;
  readonly subtitle?: string;
  readonly icon?: ReactNode;
  readonly badge?: ReactNode;
  readonly children: ReactNode;
  readonly dataLlm?: string;
};

export function WidgetFrame({
  theme,
  title,
  subtitle,
  icon,
  badge,
  children,
  dataLlm,
}: WidgetFrameProps) {
  const titleId = useId();
  return (
    <main
      className={`tv-shell${theme === 'dark' ? ' dark' : ''}`}
      data-llm={dataLlm}
    >
      <section className="tv-card" aria-labelledby={titleId}>
        <header className="tv-header">
          {icon ? (
            <span className="tv-mark" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div className="tv-title-block">
            <h1 className="tv-title" id={titleId}>
              {title}
            </h1>
            {subtitle ? <p className="tv-subtitle">{subtitle}</p> : null}
          </div>
          {badge ? <div className="tv-header-badge">{badge}</div> : null}
        </header>
        <div className="tv-body">{children}</div>
      </section>
    </main>
  );
}

type FeedbackKind = 'loading' | 'empty' | 'error' | 'partial' | 'success';

export function WidgetFeedback({
  kind,
  children,
}: {
  readonly kind: FeedbackKind;
  readonly children: ReactNode;
}) {
  const role = kind === 'error' ? 'alert' : kind === 'empty' ? undefined : 'status';
  return (
    <div className={`tv-feedback tv-feedback-${kind}`} role={role}>
      {kind === 'loading' ? <span className="tv-feedback-pulse" aria-hidden="true" /> : null}
      <p>{children}</p>
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  PENDING: 'warning',
  APPROVED: 'success',
  FULFILLED: 'success',
  DECLINED: 'danger',
  CANCELED: 'neutral',
};

const humanize = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');

export function StatusBadge({
  status,
  label,
}: {
  readonly status: string;
  readonly label?: string;
}) {
  const tone = STATUS_TONES[status] ?? 'neutral';
  return (
    <span className={`tv-badge tv-badge-${tone}`}>
      {label ?? humanize(status)}
    </span>
  );
}

type RequestRowProps = {
  readonly title: ReactNode;
  readonly meta?: ReactNode;
  readonly detail?: ReactNode;
  readonly status?: string;
  readonly statusLabel?: string;
  readonly actions?: ReactNode;
};

export function RequestRow({
  title,
  meta,
  detail,
  status,
  statusLabel,
  actions,
}: RequestRowProps) {
  return (
    <li className="tv-row">
      <div className="tv-row-main">
        <div className="tv-row-title">{title}</div>
        {meta ? <div className="tv-row-meta">{meta}</div> : null}
        {detail ? <div className="tv-row-detail">{detail}</div> : null}
      </div>
      {status ? <StatusBadge status={status} label={statusLabel} /> : null}
      {actions ? <div className="tv-actions">{actions}</div> : null}
    </li>
  );
}

type BalanceTileProps = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly progress?: number;
  readonly pending?: string;
};

export function BalanceTile({
  label,
  value,
  detail,
  progress,
  pending,
}: BalanceTileProps) {
  return (
    <article className="tv-cell">
      <h2 className="tv-cell-label">{label}</h2>
      <div className="tv-cell-value">{value}</div>
      <div className="tv-cell-detail">{detail}</div>
      {progress === undefined ? null : (
        <div
          className="tv-meter"
          role="progressbar"
          aria-label={`${label} remaining`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {pending ? <div className="tv-cell-pending">{pending}</div> : null}
    </article>
  );
}

type WidgetActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly tone?: 'default' | 'primary' | 'success' | 'danger' | 'quiet';
  readonly pending?: boolean;
  readonly pendingLabel?: string;
};

export function WidgetAction({
  tone = 'default',
  pending = false,
  pendingLabel = 'Working…',
  disabled,
  children,
  className,
  type = 'button',
  ...props
}: WidgetActionProps) {
  return (
    <button
      {...props}
      type={type}
      className={[
        'tv-btn',
        `tv-btn-${tone}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
