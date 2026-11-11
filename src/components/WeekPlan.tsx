import { useState } from 'react';
import { Calendar, CheckCircle2, ChevronDown } from 'lucide-react';
import { arrivalStatus } from '../core/routing/arrivalStatus';
import type { AppLanguage, CommutePlan, CommuteRecommendation } from '../core/types';
import { localeFor, translate } from '../i18n';
import { RecommendationDetails } from './RecommendationCard';

interface WeekPlanProps {
  language: AppLanguage;
  plans: CommutePlan[];
  routeName?(routeId: string, fallback: string): string;
  alertBadge?(routeId: string): string | undefined;
  bufferMinutes: number;
  onOpenSettings(): void;
}

const time = (date: Date, language: AppLanguage) =>
  new Intl.DateTimeFormat(localeFor(language), { hour: 'numeric', minute: '2-digit' }).format(date);

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

function statusMessage(plan: CommutePlan, language: AppLanguage): string {
  switch (plan.status) {
    case 'schedule-loading':
      return translate(language, 'scheduleLoading');
    case 'home-transit-missing':
      return translate(language, 'chooseHomeFirst');
    case 'arrival-stop-missing':
      return translate(language, 'weeklyArrivalStopMissing');
    case 'no-matching-departure':
      return translate(language, 'noMatchingDepartureHint');
    default:
      return '';
  }
}

function AlternativeRow({
  language,
  alternative,
  bufferMinutes,
}: {
  language: AppLanguage;
  alternative: CommuteRecommendation;
  bufferMinutes: number;
}) {
  const status = arrivalStatus(alternative.minutesEarly, bufferMinutes);
  const label =
    status === 'at-risk'
      ? translate(language, 'tagMayBeLate')
      : status === 'late'
        ? translate(language, 'tagLate')
        : '';
  return (
    <li className="week-plan-alternative">
      <div className="week-plan-alternative-times">
        <span className="alternative-leave">
          <span className="alternative-label">{translate(language, 'leaveHome')}</span>{' '}
          <strong>{time(alternative.leaveAt, language)}</strong>
        </span>
        <span className="alternative-dot" aria-hidden="true">
          ·
        </span>
        <span className="alternative-depart">
          {translate(language, 'departAt', { time: time(alternative.departureTime, language) })}
        </span>
        <span className="alternative-arrow" aria-hidden="true">
          →
        </span>
        <span className="alternative-arrive">
          {translate(language, 'arrive', { time: time(alternative.arrivalTime, language) })}
        </span>
      </div>
      {label && <span className={`arrival-tag arrival-tag-${status}`}>{label}</span>}
    </li>
  );
}

export function WeekPlan({
  language,
  plans,
  routeName,
  alertBadge,
  bufferMinutes,
  onOpenSettings,
}: WeekPlanProps) {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const groups = new Map<string, CommutePlan[]>();
  for (const plan of plans) {
    const key = dayKey(plan.classEvent.startTime);
    groups.set(key, [...(groups.get(key) ?? []), plan]);
  }

  const toggle = (id: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="week-plan-page">
      <div className="section-heading week-plan-heading">
        <p className="eyebrow">{translate(language, 'weekAhead')}</p>
        <h1>{translate(language, 'nextSevenDays')}</h1>
      </div>

      {plans.length === 0 ? (
        <section className="week-plan-empty">
          <span className="empty-check-icon" aria-hidden="true">
            <CheckCircle2 size={26} strokeWidth={2.4} />
          </span>
          <p>{translate(language, 'weekPlanEmpty')}</p>
        </section>
      ) : (
        <div className="week-day-list">
          {[...groups.entries()].map(([key, dayPlans]) => {
            const date = dayPlans[0]!.classEvent.startTime;
            return (
              <section className="week-day" key={key}>
                <header>
                  <div className="week-day-badge">
                    <Calendar size={14} className="week-day-icon" aria-hidden="true" />
                    <strong>
                      {new Intl.DateTimeFormat(localeFor(language), { weekday: 'long' }).format(
                        date,
                      )}
                    </strong>
                  </div>
                  <span className="week-day-date">
                    {new Intl.DateTimeFormat(localeFor(language), {
                      month: 'short',
                      day: 'numeric',
                    }).format(date)}
                  </span>
                </header>
                <div className="week-day-plans">
                  {dayPlans.map((plan) => {
                    const recommendation = plan.recommendation;
                    const badge = recommendation
                      ? alertBadge?.(recommendation.route.id)
                      : undefined;
                    const isExpanded = expandedIds.has(plan.classEvent.id);
                    const alternatives = plan.alternatives ?? [];
                    const resolvedRouteName = recommendation
                      ? (routeName?.(
                          recommendation.route.id,
                          recommendation.route.shortName || recommendation.route.longName,
                        ) ??
                        (recommendation.route.shortName || recommendation.route.longName))
                      : '';
                    return (
                      <article className="week-plan-card" key={plan.classEvent.id}>
                        <div className="week-class-row">
                          <div>
                            <strong>{plan.classEvent.title}</strong>
                            <span>
                              {plan.classEvent.location ||
                                translate(language, 'locationNotProvided')}
                            </span>
                          </div>
                          <time>{time(plan.classEvent.startTime, language)}</time>
                        </div>
                        {recommendation ? (
                          <div className="week-commute-card">
                            <button
                              type="button"
                              className="week-commute-summary"
                              aria-expanded={isExpanded}
                              onClick={() => toggle(plan.classEvent.id)}
                            >
                              <div className="week-leave-time">
                                <span>{translate(language, 'leaveHome')}</span>
                                <strong>{time(recommendation.leaveAt, language)}</strong>
                              </div>
                              <div className="week-commute-details">
                                <div className="week-route-header">
                                  <span className="week-route-badge">{resolvedRouteName}</span>
                                  {badge && <span className="route-alert-badge">{badge}</span>}
                                </div>
                                <div className="week-trip-times">
                                  <span>
                                    {translate(language, 'departAt', {
                                      time: time(recommendation.departureTime, language),
                                    })}
                                  </span>
                                  <span className="week-trip-arrow" aria-hidden="true">
                                    →
                                  </span>
                                  <span>
                                    {translate(language, 'arrive', {
                                      time: time(recommendation.arrivalTime, language),
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="week-expand-toggle" aria-hidden="true">
                                <span className="week-expand-label">
                                  {isExpanded
                                    ? translate(language, 'collapse')
                                    : translate(language, 'details')}
                                </span>
                                <ChevronDown
                                  size={15}
                                  className={`week-expand-chevron ${isExpanded ? 'rotated' : ''}`}
                                />
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="week-plan-expanded">
                                <div className="week-plan-expanded-details">
                                  <RecommendationDetails
                                    recommendation={recommendation}
                                    language={language}
                                    routeName={resolvedRouteName}
                                  />
                                </div>
                                {alternatives.length > 0 && (
                                  <div className="week-plan-alternatives">
                                    <p className="eyebrow">
                                      {translate(language, 'otherDepartures')}
                                    </p>
                                    <ul>
                                      {alternatives.map((alternative) => (
                                        <AlternativeRow
                                          key={`${alternative.leaveAt.toISOString()}-${alternative.trip.id}`}
                                          language={language}
                                          alternative={alternative}
                                          bufferMinutes={bufferMinutes}
                                        />
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="week-plan-missing">
                            <p>{statusMessage(plan, language)}</p>
                            {plan.status !== 'schedule-loading' && (
                              <button
                                type="button"
                                className="text-button"
                                onClick={onOpenSettings}
                              >
                                {translate(language, 'weeklyNoPlanHint')}
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
