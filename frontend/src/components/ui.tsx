import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  accent?: 'cyan' | 'teal' | 'amber' | 'danger' | 'purple';
}

export const Panel: React.FC<PanelProps> = ({ children, className = '', accent }) => (
  <section className={`command-panel ${accent ? `command-panel-${accent}` : ''} ${className}`}>
    {children}
  </section>
);

interface SectionHeaderProps {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  detail?: React.ReactNode;
  accent?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon: Icon, eyebrow, title, detail, accent = 'cyan' }) => (
  <div className="section-header">
    <div className="section-header-mark" style={{ color: `var(--${accent})` }}>
      <Icon size={17} strokeWidth={1.8} />
    </div>
    <div className="min-w-0">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2 className="section-title">{title}</h2>
    </div>
    {detail && <div className="section-header-detail">{detail}</div>}
  </div>
);

export const StatusPill: React.FC<{ label: string; tone?: 'live' | 'safe' | 'warning' | 'critical' | 'simulation' | 'derived' }> = ({ label, tone = 'live' }) => (
  <span className={`status-pill status-pill-${tone}`}><span className="status-dot" />{label}</span>
);

export const TelemetryChip: React.FC<{ label: string; value: React.ReactNode; tone?: 'cyan' | 'teal' | 'amber' | 'danger' }> = ({ label, value, tone = 'cyan' }) => (
  <div className={`telemetry-chip telemetry-chip-${tone}`}>
    <span className="telemetry-label">{label}</span>
    <span className="telemetry-value">{value}</span>
  </div>
);
