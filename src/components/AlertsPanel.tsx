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
  return (
    <article
      className={`alert-card${alert.severity === 'important' ? ' alert-card-important' : ''}`}
    >
      <div className="alert-card-head">
        <span className="alert-chip">{alertKindLabel(kind, language)}</span>
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
          {translate(language, 'alertOpenNotice')}
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
          <span aria-hidden="true">✓</span>
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
