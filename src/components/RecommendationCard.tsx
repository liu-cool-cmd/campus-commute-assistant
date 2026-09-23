import type { ArrivalStatus } from '../core/routing/arrivalStatus';
import type { AppLanguage, CommuteRecommendation } from '../core/types';
import { localeFor, translate } from '../i18n';

const time = (date: Date, language: AppLanguage) =>
  new Intl.DateTimeFormat(localeFor(language), { hour: 'numeric', minute: '2-digit' }).format(date);

function arrivalCopy(minutesEarly: number, language: AppLanguage): string {
  const minutes = Math.abs(minutesEarly);
  return minutesEarly < 0
    ? translate(language, 'arriveLate', { minutes })
    : translate(language, 'arriveEarly', { minutes });
}

function ArrivalTag({ status, language }: { status: ArrivalStatus; language: AppLanguage }) {
  const label =
    status === 'at-risk'
      ? translate(language, 'tagMayBeLate')
      : status === 'late'
        ? translate(language, 'tagLate')
        : '';
  if (!label) return null;
  return <span className={`arrival-tag arrival-tag-${status}`}>{label}</span>;
}

interface RecommendationCardProps {
  language: AppLanguage;
  recommendation: CommuteRecommendation;
  routeName?: string;
  badge?: string;
  arrivalStatus?: ArrivalStatus;
  compact?: boolean;
}

export function RecommendationCard({
  language,
  recommendation,
  routeName: routeNameOverride,
  badge,
  arrivalStatus = 'normal',
  compact = false,
}: RecommendationCardProps) {
  const routeName =
    routeNameOverride || recommendation.route.shortName || recommendation.route.longName;

  if (compact) {
    return (
      <article className="alternative-card">
        <div>
          <span className="eyebrow">
            {routeName}
            {badge && <span className="route-alert-badge">{badge}</span>}
            <ArrivalTag status={arrivalStatus} language={language} />
          </span>
          <strong>
            {translate(language, 'leave', { time: time(recommendation.leaveAt, language) })}
          </strong>
          {arrivalStatus === 'late' && (
            <span className="alternative-late">
              {arrivalCopy(recommendation.minutesEarly, language)}
            </span>
          )}
        </div>
        <span>
          {translate(language, 'arrive', { time: time(recommendation.arrivalTime, language) })}
        </span>
      </article>
    );
  }

  return (
    <article className="recommendation-card">
      <div className="recommendation-heading">
        <div>
          <p className="eyebrow">
            {translate(language, 'recommended')}
            {badge && <span className="route-alert-badge">{badge}</span>}
            <ArrivalTag status={arrivalStatus} language={language} />
          </p>
          <h2>
            {translate(language, 'leaveAt', { time: time(recommendation.leaveAt, language) })}
          </h2>
        </div>
        <span className={`confidence confidence-${recommendation.confidence}`}>
          {translate(language, 'confidence', {
            level: translate(language, recommendation.confidence),
          })}
        </span>
      </div>
      {/* Only the bus arrival at the boarding stop stays visible; everything else lives in details. */}
      <p className="recommendation-fact">
        <span>{translate(language, 'bus', { route: routeName })}</span>
        <strong>
          {recommendation.departureTimeIsExact === false ? translate(language, 'about') : ''}
          {time(recommendation.departureTime, language)}
        </strong>
      </p>
      <p className="early-copy">{arrivalCopy(recommendation.minutesEarly, language)}</p>
      <details className="recommendation-details">
        <summary>{translate(language, 'details')}</summary>
        <div className="journey-grid">
          {recommendation.originWalkingMinutes > 0 && (
            <>
              <span>{translate(language, 'walkTo', { stop: recommendation.originStop.name })}</span>
              <strong>
                {recommendation.originWalkingMinutes} {translate(language, 'minutesShort')}
              </strong>
            </>
          )}
          <span>
            {translate(language, 'arriveAt', { stop: recommendation.destinationStop.name })}
          </span>
          <strong>
            {time(
              new Date(
                recommendation.arrivalTime.getTime() -
                  recommendation.destinationWalkingMinutes * 60_000,
              ),
              language,
            )}
          </strong>
          {recommendation.destinationWalkingMinutes > 0 && (
            <>
              <span>{translate(language, 'walkToClass')}</span>
              <strong>
                {recommendation.destinationWalkingMinutes} {translate(language, 'minutesShort')}
              </strong>
            </>
          )}
          {recommendation.waitingMinutes > 0 && (
            <>
              <span>{translate(language, 'headwayAllowance')}</span>
              <strong>
                {translate(language, 'upToMinutes', {
                  minutes: recommendation.waitingMinutes,
                })}
              </strong>
            </>
          )}
        </div>
        {recommendation.trip.scheduleSource && (
          <p className="schedule-source-note">
            {translate(language, 'scheduleSource')}{' '}
            <a href={recommendation.trip.scheduleSource.url} target="_blank" rel="noreferrer">
              {recommendation.trip.scheduleSource.label}
            </a>
          </p>
        )}
      </details>
    </article>
  );
}
