import type { AppLanguage, CommutePlan } from '../core/types';
import { localeFor, translate } from '../i18n';

interface WeekPlanProps {
  language: AppLanguage;
  plans: CommutePlan[];
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

export function WeekPlan({ language, plans, onOpenSettings }: WeekPlanProps) {
  const groups = new Map<string, CommutePlan[]>();
  for (const plan of plans) {
    const key = dayKey(plan.classEvent.startTime);
    groups.set(key, [...(groups.get(key) ?? []), plan]);
  }

  return (
    <section className="week-plan-page">
      <div className="section-heading week-plan-heading">
        <p className="eyebrow">{translate(language, 'weekAhead')}</p>
        <h1>{translate(language, 'nextSevenDays')}</h1>
      </div>

      {plans.length === 0 ? (
        <section className="week-plan-empty">
          <span aria-hidden="true">✓</span>
          <p>{translate(language, 'weekPlanEmpty')}</p>
        </section>
      ) : (
        <div className="week-day-list">
          {[...groups.entries()].map(([key, dayPlans]) => {
            const date = dayPlans[0]!.classEvent.startTime;
            return (
              <section className="week-day" key={key}>
                <header>
                  <strong>
                    {new Intl.DateTimeFormat(localeFor(language), { weekday: 'long' }).format(date)}
                  </strong>
                  <span>
                    {new Intl.DateTimeFormat(localeFor(language), {
                      month: 'short',
                      day: 'numeric',
                    }).format(date)}
                  </span>
                </header>
                <div className="week-day-plans">
                  {dayPlans.map((plan) => {
                    const recommendation = plan.recommendation;
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
                          <div className="week-commute-summary">
                            <div className="week-leave-time">
                              <span>{translate(language, 'leaveHome')}</span>
                              <strong>{time(recommendation.leaveAt, language)}</strong>
                            </div>
                            <div className="week-route-line">
                              <span className="week-route-badge">
                                {recommendation.route.shortName || recommendation.route.longName}
                              </span>
                              <span>
                                {translate(language, 'departAt', {
                                  time: time(recommendation.departureTime, language),
                                })}
                              </span>
                              <span aria-hidden="true">→</span>
                              <span>
                                {translate(language, 'arrive', {
                                  time: time(recommendation.arrivalTime, language),
                                })}
                              </span>
                            </div>
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
