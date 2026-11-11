import { CheckCircle2, ExternalLink, Info, ShieldAlert } from 'lucide-react';
import { classifyAlertKind } from '../core/alerts/labels';
import type { TransitAlert } from '../core/alerts/types';
import type { AppLanguage } from '../core/types';
import { translate } from '../i18n';
import { alertKindLabel } from './alertLabels';

type RouteNameLookup = (routeId: string, fallback: string) => string;

interface AlertCardProps {
  language: AppLanguage;
  alert: TransitAlert;
  compact?: boolean;
  routeName?: RouteNameLookup;
}

function AlertCard({ language, alert, compact = false, routeName }: AlertCardProps) {
  const kind = classifyAlertKind(alert.message);
  const isImportant = alert.severity === 'important';
  return (
    <article className={`alert-card${isImportant ? ' alert-card-important' : ''}`}>
      <div className="alert-card-head">
        <span className="alert-chip">
          {isImportant ? (
            <ShieldAlert size={12} className="alert-badge-icon" aria-hidden="true" />
          ) : (
            <Info size={12} className="alert-badge-icon" aria-hidden="true" />
          )}
          <span>{alertKindLabel(kind, language)}</span>
        </span>
        <span className="alert-source">
          {translate(
            language,
            alert.source === 'transloc' ? 'alertSourceTransloc' : 'alertSourceParking',
          )}
        </span>
      </div>
      {alert.title && <strong className="alert-title">{alert.title}</strong>}
      <p className="alert-message">{alert.message}</p>
      {!compact && routeName && alert.affectedRouteIds.length > 0 && (
        <p className="alert-routes">
          {translate(language, 'alertAffectedRoutes', {
            routes: alert.affectedRouteIds.map((routeId) => routeName(routeId, routeId)).join(', '),
          })}
        </p>
      )}
      {!compact && alert.link && (
        <a className="alert-link" href={alert.link} target="_blank" rel="noreferrer">
          <span>{translate(language, 'alertOpenNotice')}</span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </article>
  );
}

interface AlertsSummaryProps {
  language: AppLanguage;
  /** Active alerts, already ordered with the ones related to the next trip first. */
  alerts: TransitAlert[];
  onOpen(): void;
}

export function AlertsSummary({ language, alerts, onOpen }: AlertsSummaryProps) {
  const preview = alerts.slice(0, 2);
  // Alerts are usually empty; the dedicated Alerts tab still carries the full (and empty) list.
  if (preview.length === 0) return null;
  return (
    <section className="alerts-summary">
      <div className="section-heading compact-heading">
        <p className="eyebrow">{translate(language, 'alertsSection')}</p>
        <h2>{translate(language, 'alertsNav')}</h2>
      </div>
      <div className="alert-list">
        {preview.map((alert) => (
          <AlertCard key={alert.id} language={language} alert={alert} compact />
        ))}
      </div>
      <button className="text-button" type="button" onClick={onOpen}>
        {translate(language, 'alertsViewAll')}
      </button>
    </section>
  );
}

interface AlertsPanelProps {
  language: AppLanguage;
  /** Active alerts, already ordered with the ones related to the next trip first. */
  alerts: TransitAlert[];
  routeName(routeId: string, fallback: string): string;
}

export function AlertsPanel({ language, alerts, routeName }: AlertsPanelProps) {
  return (
    <section className="alerts-page">
      <div className="section-heading">
        <p className="eyebrow">{translate(language, 'alertsSection')}</p>
        <h1>{translate(language, 'alertsNav')}</h1>
      </div>
      {alerts.length === 0 ? (
        <section className="week-plan-empty">
          <span className="empty-check-icon" aria-hidden="true">
            <CheckCircle2 size={26} strokeWidth={2.4} />
          </span>
          <p>{translate(language, 'alertsEmpty')}</p>
        </section>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} language={language} alert={alert} routeName={routeName} />
          ))}
        </div>
      )}
    </section>
  );
}
