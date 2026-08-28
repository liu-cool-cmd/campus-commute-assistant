import { Capacitor } from '@capacitor/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultCampus } from './campuses';
import { ImportClasses } from './components/ImportClasses';
import { LiveRouteOverlay } from './components/LiveRouteOverlay';
import { LiveTripMap } from './components/LiveTripMap';
import { LiveTransitMap } from './components/LiveTransitMap';
import { RecommendationCard } from './components/RecommendationCard';
import { SettingsPanel } from './components/SettingsPanel';
import { ClassDestinationField } from './components/TransitPreferences';
import { WeekPlan } from './components/WeekPlan';
import { buildingBindingKey, classBindingKey } from './core/calendar/bindings';
import { loadGtfs, type GtfsSnapshot } from './core/gtfs/client';
import { getDownstreamStops } from './core/gtfs/selection';
import { findBuilding } from './core/locations/geo';
import { scheduleCommuteNotification } from './core/notifications/local';
import { buildWeekPlans } from './core/planning/week';
import { RealtimeSnapshotCache } from './core/realtime/realtimeCache';
import { calculateLiveTripProgress, type LiveTripProgress } from './core/realtime/routeProgress';
import { getCommuteRecommendations } from './core/routing/engine';
import { loadClasses, loadSettings, saveClasses, saveSettings } from './core/storage/preferences';
import type { ClassEvent, RealtimeSnapshot, TransitSelection, UserSettings } from './core/types';
import { syncAndroidWidgets } from './core/widgets/android';
import { localeFor, translate } from './i18n';

const campus = defaultCampus;
const routeName = (routeId: string, fallback: string) =>
  campus.routeFamilies?.find((family) => family.routeIds.includes(routeId))?.name || fallback;
const defaults: UserSettings = {
  campusId: campus.config.id,
  language: 'en',
  defaultBufferMinutes: campus.config.defaultBufferMinutes,
  walkingSpeedMetersPerSecond: 1.3,
  walkingCorrectionFactor: 1.25,
  classStopBindings: {},
  groupClassStopsByBuilding: false,
  buildingStopBindings: {},
};

const gtfsUrl = () =>
  !Capacitor.isNativePlatform() && import.meta.env.DEV && campus.config.developmentGtfsUrl
    ? campus.config.developmentGtfsUrl
    : campus.config.gtfsUrl;

const classDate = (date: Date, language: UserSettings['language']) =>
  new Intl.DateTimeFormat(localeFor(language), {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);
const classTime = (date: Date, language: UserSettings['language']) =>
  new Intl.DateTimeFormat(localeFor(language), { hour: 'numeric', minute: '2-digit' }).format(date);

export default function App() {
  const [tab, setTab] = useState<'home' | 'week' | 'settings' | 'live-trip-map' | 'official-map'>(
    'home',
  );
  const [settings, setSettings] = useState<UserSettings>(defaults);
  const [classes, setClasses] = useState<ClassEvent[]>([]);
  const [snapshot, setSnapshot] = useState<GtfsSnapshot>();
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gtfsError, setGtfsError] = useState('');
  const [notificationScheduled, setNotificationScheduled] = useState(false);
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<RealtimeSnapshot>();
  const [now, setNow] = useState(() => new Date());
  const contentRef = useRef<HTMLElement>(null);
  const realtimeCache = useMemo(() => new RealtimeSnapshotCache(campus.realtime), []);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [tab]);

  const refreshGtfs = async (forceRefresh = false) => {
    setRefreshing(true);
    try {
      const loaded = await loadGtfs({
        campusId: campus.config.id,
        url: gtfsUrl(),
        refreshHours: campus.config.gtfsRefreshHours,
        forceRefresh,
      });
      setSnapshot({
        ...loaded,
        feed: campus.supplementGtfs?.(loaded.feed) ?? loaded.feed,
      });
      setGtfsError('');
    } catch (error) {
      setGtfsError(error instanceof Error ? error.message : 'Could not load the GTFS schedule.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadSettings(defaults), loadClasses()]).then(
      ([storedSettings, storedClasses]) => {
        setSettings(
          campus.migrateSettings?.(storedSettings) ?? {
            ...storedSettings,
            homeTransit:
              campus.migrateHomeTransit?.(storedSettings.homeTransit) ?? storedSettings.homeTransit,
          },
        );
        setClasses(storedClasses);
        setHydrated(true);
      },
    );
    void refreshGtfs();
    const refreshTimer = window.setInterval(() => void refreshGtfs(), 6 * 60 * 60 * 1_000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (hydrated) void saveSettings(settings);
  }, [hydrated, settings]);

  const upcomingClasses = useMemo(
    () =>
      classes
        .filter((event) => event.startTime.getTime() > now.getTime())
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    [classes, now],
  );
  const nextClass = upcomingClasses[0];
  const nextClassBindingKey = nextClass
    ? settings.groupClassStopsByBuilding
      ? buildingBindingKey(nextClass, campus.buildings)
      : classBindingKey(nextClass)
    : undefined;
  const destinationBuilding = nextClass
    ? findBuilding(nextClass.location, campus.buildings)
    : undefined;
  const configuredDestinationStopId = nextClassBindingKey
    ? settings.groupClassStopsByBuilding
      ? settings.buildingStopBindings?.[nextClassBindingKey]
      : settings.classStopBindings?.[nextClassBindingKey]
    : undefined;
  const destinationStopId = useMemo(() => {
    if (
      !snapshot ||
      !settings.homeTransit?.routeId ||
      !settings.homeTransit.originStopId ||
      !configuredDestinationStopId
    ) {
      return undefined;
    }
    return getDownstreamStops(
      snapshot.feed,
      settings.homeTransit.routeId,
      settings.homeTransit.originStopId,
    ).some((stop) => stop.id === configuredDestinationStopId)
      ? configuredDestinationStopId
      : undefined;
  }, [configuredDestinationStopId, settings.homeTransit, snapshot]);
  const transitSelection = useMemo<TransitSelection | undefined>(
    () =>
      settings.homeTransit?.routeId && settings.homeTransit.originStopId && destinationStopId
        ? {
            routeId: settings.homeTransit.routeId,
            originStopId: settings.homeTransit.originStopId,
            destinationStopId,
          }
        : undefined,
    [destinationStopId, settings.homeTransit?.originStopId, settings.homeTransit?.routeId],
  );
  const transitSelections = useMemo(() => {
    if (!transitSelection || !snapshot || !nextClass) return [];
    return campus.resolveTransitSelections
      ? campus.resolveTransitSelections(
          transitSelection,
          snapshot.feed,
          nextClass.startTime,
          settings.homeTransit?.routeFamilyId,
        )
      : [transitSelection];
  }, [nextClass, settings.homeTransit?.routeFamilyId, snapshot, transitSelection]);

  useEffect(() => {
    if (!snapshot || !nextClass || !settings.transitSelection) return;
    const migrated =
      campus.migrateTransitSelection?.(settings.transitSelection) ?? settings.transitSelection;
    if (!migrated.routeId || !migrated.originStopId) return;
    const key = classBindingKey(nextClass);
    setSettings((current) => ({
      ...current,
      homeTransit: current.homeTransit ?? {
        routeId: migrated.routeId,
        originStopId: migrated.originStopId,
      },
      classStopBindings: migrated.destinationStopId
        ? { ...(current.classStopBindings ?? {}), [key]: migrated.destinationStopId }
        : current.classStopBindings,
      transitSelection: undefined,
    }));
  }, [nextClass, settings.transitSelection, snapshot]);

  const recommendations = useMemo(() => {
    if (!nextClass || !snapshot) return [];
    return transitSelections
      .flatMap((selection) => {
        const originStop = snapshot.feed.stops.find((stop) => stop.id === selection.originStopId);
        const destinationStop = snapshot.feed.stops.find(
          (stop) => stop.id === selection.destinationStopId,
        );
        if (!originStop || !destinationStop) return [];
        return getCommuteRecommendations({
          feed: snapshot.feed,
          request: {
            origin: settings.home ?? originStop,
            destination: destinationBuilding ?? destinationStop,
            arrivalDeadline: nextClass.startTime,
            bufferMinutes: settings.defaultBufferMinutes,
          },
          transitSelection: selection,
          serviceTimezone: campus.config.timezone,
          walkingSpeedMetersPerSecond: settings.walkingSpeedMetersPerSecond,
          walkingCorrectionFactor: settings.walkingCorrectionFactor,
        });
      })
      .sort((left, right) => right.leaveAt.getTime() - left.leaveAt.getTime());
  }, [destinationBuilding, nextClass, settings, snapshot, transitSelections]);

  const visibleRecommendations = useMemo(() => {
    const distinctDepartures = new Map<string, (typeof recommendations)[number]>();
    for (const recommendation of recommendations) {
      const key = [
        recommendation.route.id,
        recommendation.originStop.id,
        recommendation.destinationStop.id,
        recommendation.departureTime.toISOString(),
        recommendation.arrivalTime.toISOString(),
      ].join(':');
      if (!distinctDepartures.has(key)) distinctDepartures.set(key, recommendation);
    }
    return [...distinctDepartures.values()];
  }, [recommendations]);
  const recommended = visibleRecommendations[0];
  const alternatives = visibleRecommendations.slice(1, 4);
  const recommendedRouteName = recommended
    ? routeName(recommended.route.id, recommended.route.shortName || recommended.route.longName)
    : '';

  useEffect(() => {
    if (!recommended || !campus.realtime.available) return;
    let disposed = false;
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void realtimeCache
        .refresh(controller.signal)
        .then((value) => {
          if (!disposed) setRealtimeSnapshot(value);
        })
        .catch(() => undefined);
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [realtimeCache, recommended]);

  const liveTripProgress = useMemo<LiveTripProgress>(() => {
    if (!recommended || !realtimeSnapshot) {
      return {
        status: 'unavailable',
        reason: 'no-active-vehicle',
        vehicleToBoardingPath: [],
        boardingToArrivalPath: [],
        passedPath: [],
        displayStops: [],
      };
    }
    return calculateLiveTripProgress({
      snapshot: realtimeSnapshot,
      routeId: recommended.route.id,
      boardingStopId: recommended.originStop.id,
      arrivalStopId: recommended.destinationStop.id,
      now,
    });
  }, [now, realtimeSnapshot, recommended]);

  const weekPlans = useMemo(
    () =>
      buildWeekPlans({
        events: classes,
        feed: snapshot?.feed,
        settings,
        buildings: campus.buildings,
        serviceTimezone: campus.config.timezone,
        now,
        resolveTransitSelections: campus.resolveTransitSelections,
      }),
    [classes, now, settings, snapshot],
  );

  useEffect(() => {
    if (!hydrated) return;
    void syncAndroidWidgets(weekPlans, settings.language, routeName).catch(() => undefined);
  }, [hydrated, settings.language, weekPlans]);

  useEffect(() => {
    setNotificationScheduled(false);
    if (nextClass && recommended) {
      void scheduleCommuteNotification(
        nextClass,
        recommended,
        settings.language,
        recommendedRouteName,
      ).then(setNotificationScheduled);
    }
  }, [nextClass, recommended, recommendedRouteName, settings.language]);

  const importClasses = (events: ClassEvent[]) => {
    setClasses(events);
    void saveClasses(events);
  };

  const setNextClassStop = (nextDestinationStopId?: string) => {
    if (!nextClassBindingKey) return;
    if (settings.groupClassStopsByBuilding) {
      const buildingStopBindings = { ...(settings.buildingStopBindings ?? {}) };
      if (nextDestinationStopId) {
        buildingStopBindings[nextClassBindingKey] = nextDestinationStopId;
      } else {
        delete buildingStopBindings[nextClassBindingKey];
      }
      setSettings({ ...settings, buildingStopBindings });
    } else {
      const classStopBindings = { ...(settings.classStopBindings ?? {}) };
      if (nextDestinationStopId) classStopBindings[nextClassBindingKey] = nextDestinationStopId;
      else delete classStopBindings[nextClassBindingKey];
      setSettings({ ...settings, classStopBindings });
    }
  };

  if (tab === 'live-trip-map' && recommended) {
    return (
      <LiveTripMap
        language={settings.language}
        routeName={recommendedRouteName}
        progress={liveTripProgress}
        home={settings.home}
        destination={destinationBuilding}
        onClose={() => setTab('home')}
        onOpenOfficial={() => setTab('official-map')}
      />
    );
  }

  if (tab === 'official-map' && campus.config.liveMapUrl) {
    return (
      <LiveTransitMap
        url={campus.config.liveMapUrl}
        language={settings.language}
        onClose={() => setTab('home')}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">CCA</div>
        <div>
          <strong>Campus Commute</strong>
          <span>{campus.config.name}</span>
        </div>
        <button
          className="icon-button"
          aria-label={translate(settings.language, 'openSettings')}
          onClick={() => setTab('settings')}
        >
          ⚙
        </button>
      </header>

      <main ref={contentRef}>
        {tab === 'home' ? (
          <>
            {!nextClass ? (
              <section className="empty-state">
                <div className="empty-icon">↗</div>
                <p className="eyebrow">{translate(settings.language, 'startHere')}</p>
                <h1>{translate(settings.language, 'whenShouldYouLeave')}</h1>
                <p>{translate(settings.language, 'importPrompt')}</p>
                <ImportClasses language={settings.language} onImport={importClasses} />
              </section>
            ) : (
              <>
                <section className="next-class-card">
                  <div>
                    <p className="eyebrow">
                      {translate(settings.language, 'nextClass')} ·{' '}
                      {classDate(nextClass.startTime, settings.language)}
                    </p>
                    <h1>{nextClass.title}</h1>
                    <p>
                      {nextClass.location || translate(settings.language, 'locationNotProvided')}
                    </p>
                  </div>
                  <time>{classTime(nextClass.startTime, settings.language)}</time>
                </section>

                {!settings.home && settings.homeTransit?.originStopId && (
                  <section className="notice-card">
                    <strong>{translate(settings.language, 'walkNotIncluded')}</strong>
                    <p>{translate(settings.language, 'addHomePin')}</p>
                    <button className="secondary-button" onClick={() => setTab('settings')}>
                      {translate(settings.language, 'setHomeLocation')}
                    </button>
                  </section>
                )}

                {!snapshot && (
                  <section className="notice-card">
                    <strong>
                      {translate(
                        settings.language,
                        refreshing ? 'loadingTransit' : 'transitUnavailable',
                      )}
                    </strong>
                    <p>{gtfsError || translate(settings.language, 'firstDownload')}</p>
                    {!refreshing && (
                      <button className="secondary-button" onClick={() => void refreshGtfs(true)}>
                        {translate(settings.language, 'tryAgain')}
                      </button>
                    )}
                  </section>
                )}

                {snapshot &&
                  (!settings.homeTransit?.routeId || !settings.homeTransit.originStopId) && (
                    <section className="notice-card">
                      <strong>{translate(settings.language, 'chooseHomeStop')}</strong>
                      <p>{translate(settings.language, 'chooseHomeStopHint')}</p>
                      <button className="secondary-button" onClick={() => setTab('settings')}>
                        {translate(settings.language, 'configureHomeTransit')}
                      </button>
                    </section>
                  )}

                {snapshot && settings.homeTransit?.routeId && settings.homeTransit.originStopId && (
                  <ClassDestinationField
                    language={settings.language}
                    feed={snapshot.feed}
                    routeId={settings.homeTransit.routeId}
                    originStopId={settings.homeTransit.originStopId}
                    classEvent={nextClass}
                    value={destinationStopId}
                    onChange={setNextClassStop}
                    sharedByBuilding={settings.groupClassStopsByBuilding}
                    card
                  />
                )}

                {snapshot && transitSelection && recommendations.length === 0 && (
                  <section className="notice-card warning-card">
                    <strong>{translate(settings.language, 'noMatchingDeparture')}</strong>
                    <p>{translate(settings.language, 'noMatchingDepartureHint')}</p>
                  </section>
                )}

                {recommended && (
                  <>
                    <RecommendationCard
                      language={settings.language}
                      classEvent={nextClass}
                      recommendation={recommended}
                      routeName={recommendedRouteName}
                    />
                    <LiveRouteOverlay
                      language={settings.language}
                      routeName={recommendedRouteName}
                      progress={liveTripProgress}
                      onOpen={() => setTab('live-trip-map')}
                    />
                    {notificationScheduled && (
                      <p className="notification-note">
                        {translate(settings.language, 'reminderScheduled')}
                      </p>
                    )}
                    {alternatives.length > 0 && (
                      <section className="alternatives-section">
                        <div className="section-heading compact-heading">
                          <p className="eyebrow">{translate(settings.language, 'backups')}</p>
                          <h2>{translate(settings.language, 'alternatives')}</h2>
                        </div>
                        {alternatives.map((alternative) => (
                          <RecommendationCard
                            language={settings.language}
                            key={`${alternative.leaveAt.toISOString()}-${alternative.trip.id}`}
                            classEvent={nextClass}
                            recommendation={alternative}
                            routeName={routeName(
                              alternative.route.id,
                              alternative.route.shortName || alternative.route.longName,
                            )}
                            compact
                          />
                        ))}
                      </section>
                    )}
                    <div className="action-row">
                      {campus.config.liveMapUrl && (
                        <button
                          className="primary-button live-map-button"
                          type="button"
                          onClick={() => setTab('official-map')}
                        >
                          {translate(settings.language, 'openFullTransloc')}
                        </button>
                      )}
                      <button className="text-button" onClick={() => setTab('settings')}>
                        {translate(settings.language, 'adjustDefaults')}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        ) : tab === 'week' ? (
          <WeekPlan
            language={settings.language}
            plans={weekPlans}
            routeName={routeName}
            onOpenSettings={() => setTab('settings')}
          />
        ) : (
          <SettingsPanel
            settings={settings}
            campus={campus.config}
            buildings={campus.buildings}
            gtfsUpdatedAt={snapshot?.fetchedAt}
            refreshing={refreshing}
            feed={snapshot?.feed}
            routeFamilies={campus.routeFamilies}
            classes={classes}
            onSettings={setSettings}
            onImportClasses={importClasses}
            onRefresh={() => void refreshGtfs(true)}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label={translate(settings.language, 'primaryNavigation')}>
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
          <span>⌂</span>
          {translate(settings.language, 'nextTrip')}
        </button>
        <button className={tab === 'week' ? 'active' : ''} onClick={() => setTab('week')}>
          <span>▦</span>
          {translate(settings.language, 'weekPlanNav')}
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          <span>⚙</span>
          {translate(settings.language, 'settings')}
        </button>
      </nav>
    </div>
  );
}
