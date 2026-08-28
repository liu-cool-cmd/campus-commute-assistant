import type { AppLanguage, ClassEvent, CommuteRecommendation } from '../core/types';
import { localeFor, translate } from '../i18n';

const time = (date: Date, language: AppLanguage) =>
  new Intl.DateTimeFormat(localeFor(language), { hour: 'numeric', minute: '2-digit' }).format(date);

interface RecommendationCardProps {
  language: AppLanguage;
  classEvent: ClassEvent;
  recommendation: CommuteRecommendation;
  routeName?: string;
  compact?: boolean;
}

export function RecommendationCard({
  language,
  classEvent,
  recommendation,
  routeName: routeNameOverride,
  compact = false,
}: RecommendationCardProps) {
  const routeName =
    routeNameOverride || recommendation.route.shortName || recommendation.route.longName;
  if (compact) {
    return (
      <article className="alternative-card">
        <div>
          <span className="eyebrow">{routeName}</span>
          <strong>
            {translate(language, 'leave', { time: time(recommendation.leaveAt, language) })}
          </strong>
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
          <p className="eyebrow">{translate(language, 'recommended')}</p>
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
      <div className="journey-grid">
        <span>{translate(language, 'leaveHome')}</span>
        <strong>{time(recommendation.leaveAt, language)}</strong>
        <>
          {recommendation.originWalkingMinutes > 0 && (
            <>
              <span>{translate(language, 'walkTo', { stop: recommendation.originStop.name })}</span>
              <strong>
                {recommendation.originWalkingMinutes} {translate(language, 'minutesShort')}
              </strong>
            </>
          )}
          <span>{translate(language, 'bus', { route: routeName })}</span>
          <strong>
            {recommendation.departureTimeIsExact === false ? translate(language, 'about') : ''}
            {time(recommendation.departureTime, language)}
          </strong>
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
        </>
        <span className="class-row">{translate(language, 'classLabel')}</span>
        <strong className="class-row">{time(classEvent.startTime, language)}</strong>
      </div>
      <p className="early-copy">
        {translate(language, 'arriveEarly', { minutes: recommendation.minutesEarly })}
      </p>
      {recommendation.trip.scheduleSource && (
        <p className="schedule-source-note">
          {translate(language, 'scheduleSource')}{' '}
          <a href={recommendation.trip.scheduleSource.url} target="_blank" rel="noreferrer">
            {recommendation.trip.scheduleSource.label}
          </a>
        </p>
      )}
    </article>
  );
}
