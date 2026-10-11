import type { ReactNode } from "react";

interface ResearchLayoutProps {
  children: ReactNode;
  rail?: ReactNode;
  railTitle?: string;
  railKicker?: string;
}

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function ResearchLayout({ children, rail, railTitle, railKicker }: ResearchLayoutProps) {
  return (
    <div className={`research-layout ${rail ? "" : "research-layout--no-rail"}`}>
      <section className="chart-stage">{children}</section>
      {rail ? (
        <aside className="analysis-rail">
          {(railTitle || railKicker) && (
            <div className="analysis-rail__head">
              {railKicker ? <div className="analysis-rail__kicker">{railKicker}</div> : null}
              {railTitle ? <h2>{railTitle}</h2> : null}
            </div>
          )}
          <div className="analysis-rail__body">{rail}</div>
        </aside>
      ) : null}
    </div>
  );
}

export function RailSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rail-section">
      {title ? <div className="rail-section__title">{title}</div> : null}
      {children}
    </section>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented-control">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented-control__item ${value === option.value ? "active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function MetricStrip({
  items,
}: {
  items: { label: string; value: string | number; tone?: "accent" | "muted" }[];
}) {
  return (
    <div className="metric-strip">
      {items.map((item) => (
        <div className={`metric-strip__item ${item.tone ? `metric-strip__item--${item.tone}` : ""}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function LegendList({
  items,
}: {
  items: {
    key: string;
    label: string;
    value?: string | number;
    color?: string;
    active?: boolean;
    onClick?: () => void;
  }[];
}) {
  return (
    <div className="legend-list">
      {items.map((item) => {
        const content = (
          <>
            <span className="legend-list__swatch" style={{ background: item.color || "var(--border)" }} />
            <span className="legend-list__label">{item.label}</span>
            {item.value !== undefined ? <span className="legend-list__value">{item.value}</span> : null}
          </>
        );
        return item.onClick ? (
          <button
            type="button"
            className={`legend-list__item ${item.active === false ? "is-muted" : ""}`}
            key={item.key}
            onClick={item.onClick}
          >
            {content}
          </button>
        ) : (
          <div className={`legend-list__item ${item.active === false ? "is-muted" : ""}`} key={item.key}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
