import { Bus, ChevronDown, Clock, Footprints, Info, MapPin } from 'lucide-react';
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

interface RecommendationDetailsProps {
  recommendation: CommuteRecommendation;
  language: AppLanguage;
  routeName?: string;
}

interface JourneyTimelineStep {
  key: string;
  iconType: 'walk' | 'bus' | 'pin' | 'clock';
  label: string;
  value: string;
}

/**
 * The expandable journey breakdown shared by the home recommendation card and the
 * week plan, so both surfaces describe a trip identically.
 */
export function RecommendationDetails({
  recommendation,
  language,
  routeName: routeNameOverride,
}: RecommendationDetailsProps) {
  const resolvedRouteName =
    routeNameOverride || recommendation.route.shortName || recommendation.route.longName;

  const destinationStopTime = new Date(
    recommendation.arrivalTime.getTime() - recommendation.destinationWalkingMinutes * 60_000,
  );

  const steps: JourneyTimelineStep[] = [];

  if (recommendation.originWalkingMinutes > 0) {
    steps.push({
      key: 'origin-walk',
      iconType: 'walk',
      label: translate(language, 'walkTo', { stop: recommendation.originStop.name }),
      value: `${recommendation.originWalkingMinutes} ${translate(language, 'minutesShort')}`,
    });
  }

  steps.push({
    key: 'transit-bus',
    iconType: 'bus',
    label: translate(language, 'bus', { route: resolvedRouteName }),
    value: translate(language, 'departAt', {
      time: time(recommendation.departureTime, language),
    }),
  });

  steps.push({
    key: 'dest-stop',
    iconType: 'pin',
    label: translate(language, 'arriveAt', { stop: recommendation.destinationStop.name }),
    value: time(destinationStopTime, language),
  });

  if (recommendation.destinationWalkingMinutes > 0) {
    steps.push({
      key: 'dest-walk',
      iconType: 'walk',
      label: translate(language, 'walkToClass'),
      value: `${recommendation.destinationWalkingMinutes} ${translate(language, 'minutesShort')}`,
    });
  }

  if (recommendation.waitingMinutes > 0) {
    steps.push({
      key: 'waiting-headway',
      iconType: 'clock',
      label: translate(language, 'headwayAllowance'),
      value: translate(language, 'upToMinutes', {
        minutes: recommendation.waitingMinutes,
      }),
    });
  }

  return (
    <>
      <div className="journey-grid">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <div className={`journey-step ${isLast ? 'journey-step-last' : ''}`} key={step.key}>
              <span className="journey-step-label">
                <span className="timeline-icon-wrap" aria-hidden="true">
                  {step.iconType === 'walk' && <Footprints size={15} className="timeline-icon" />}
                  {step.iconType === 'bus' && (
                    <Bus size={15} className="timeline-icon timeline-bus-icon" />
                  )}
                  {step.iconType === 'pin' && (
                    <MapPin size={15} className="timeline-icon timeline-stop-icon" />
                  )}
                  {step.iconType === 'clock' && (
                    <Clock size={15} className="timeline-icon timeline-clock-icon" />
                  )}
                  {!isLast && <span className="timeline-connector" />}
                </span>
                <span className="journey-step-text">{step.label}</span>
              </span>
              <strong className="journey-step-value">{step.value}</strong>
            </div>
          );
        })}
      </div>
      {recommendation.trip.scheduleSource && (
        <p className="schedule-source-note">
          <Info size={13} className="schedule-source-icon" aria-hidden="true" />
          <span>
            {translate(language, 'scheduleSource')}{' '}
            <a href={recommendation.trip.scheduleSource.url} target="_blank" rel="noreferrer">
              {recommendation.trip.scheduleSource.label}
            </a>
          </span>
        </p>
      )}
    </>
  );
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
        <div className="alternative-card-header">
          <span className="eyebrow">
            <span className="route-pill">{routeName}</span>
            {badge && <span className="route-alert-badge">{badge}</span>}
            <ArrivalTag status={arrivalStatus} language={language} />
          </span>
        </div>
        <div className="alternative-card-times">
          <strong>
            {translate(language, 'leave', { time: time(recommendation.leaveAt, language) })}
          </strong>
          <span>
            {translate(language, 'arrive', { time: time(recommendation.arrivalTime, language) })}
          </span>
        </div>
        {arrivalStatus === 'late' && (
          <span className="alternative-late">
            {arrivalCopy(recommendation.minutesEarly, language)}
          </span>
        )}
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
        <span className="recommendation-fact-route">
          <span className="live-pulse-dot" aria-hidden="true" />
          <Bus size={17} className="recommendation-bus-icon" aria-hidden="true" />
          <span>{translate(language, 'bus', { route: routeName })}</span>
        </span>
        <strong>
          {recommendation.departureTimeIsExact === false ? translate(language, 'about') : ''}
          {time(recommendation.departureTime, language)}
        </strong>
      </p>
      <p
        className={`early-copy ${recommendation.minutesEarly < 0 ? 'early-copy-late' : 'early-copy-ontime'}`}
      >
        <Clock size={15} className="early-copy-icon" aria-hidden="true" />
        <span>{arrivalCopy(recommendation.minutesEarly, language)}</span>
      </p>
      <details className="recommendation-details">
        <summary>
          <span>{translate(language, 'details')}</span>
          <ChevronDown size={16} className="details-chevron" aria-hidden="true" />
        </summary>
        <RecommendationDetails
          recommendation={recommendation}
          language={language}
          routeName={routeName}
        />
      </details>
    </article>
  );
}
