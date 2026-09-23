import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultCampus } from './campuses';
import {
  buildDukeAlertCatalog,
  DUKE_EMPTY_ALERT_CATALOG,
  DukeParkingRssSource,
  DukeTranslocAlertSource,
} from './campuses/duke/alerts';
import { AlertsPanel, AlertsSummary } from './components/AlertsPanel';
import { alertKindLabel } from './components/alertLabels';
import { ImportClasses } from './components/ImportClasses';
import { LiveRouteOverlay } from './components/LiveRouteOverlay';
import { LiveTripMap } from './components/LiveTripMap';
import { LiveTransitMap } from './components/LiveTransitMap';
import { RecommendationCard } from './components/RecommendationCard';
import { SettingsPanel, type SettingsFocusSection } from './components/SettingsPanel';
import { settingsScrollTop } from './components/settingsScroll';
import { WeekPlan } from './components/WeekPlan';
import { buildingBindingKey, classBindingKey } from './core/calendar/bindings';
import {
  loadAlertNotificationState,
  loadCachedAlerts,
  saveAlertNotificationState,
  saveCachedAlerts,
} from './core/alerts/cache';
import { selectAlertsToNotify } from './core/alerts/dedupe';
import type { AlertNotificationState } from './core/alerts/dedupe';
import { alertKindForRoute } from './core/alerts/labels';
import {
  alertMatchesContext,
  mergeAlertNotificationContext,
  selectNotifiableAlerts,
} from './core/alerts/notification';
import { sortAlertsForDisplay, withActiveStatus } from './core/alerts/types';
import type { TransitAlert } from './core/alerts/types';
import type { AlertNotificationScope } from './core/alerts/types';
import { loadGtfs, type GtfsSnapshot } from './core/gtfs/client';
import { getDownstreamStops } from './core/gtfs/selection';
import { findBuilding } from './core/locations/geo';
import {
  scheduleAlertNotifications,
  scheduleCommuteNotification,
} from './core/notifications/local';
import { buildWeekPlans } from './core/planning/week';
import { isRealtimeSnapshotIdentical, RealtimeSnapshotCache } from './core/realtime/realtimeCache';
import { calculateLiveTripProgress, type LiveTripProgress } from './core/realtime/routeProgress';
import { applyLiveTripFallback } from './core/realtime/routeProgressFallback';
import { getCommuteRecommendations, getFollowingDepartures } from './core/routing/engine';
import { arrivalStatus, buildAlternativeList } from './core/routing/arrivalStatus';
import { loadClasses, loadSettings, saveClasses, saveSettings } from './core/storage/preferences';
import type {
  ClassEvent,
  CommuteRecommendation,
  RealtimeSnapshot,
  TransitSelection,
  UserSettings,
} from './core/types';
import { findFamilyStopByStopId, mapFamilyStopToVariant } from './campuses/duke/routeFamilies';
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
  alertNotifications: 'my-routes',
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

function areTransitSelectionsEqual(a: TransitSelection[], b: TransitSelection[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i];
    const itemB = b[i];
    if (!itemA || !itemB) return false;
    if (
      itemA.routeId !== itemB.routeId ||
      itemA.originStopId !== itemB.originStopId ||
      itemA.destinationStopId !== itemB.destinationStopId
    ) {
      return false;
    }
  }
  return true;
}

export default function App() {
  const [tab, setTab] = useState<
    'home' | 'week' | 'alerts' | 'settings' | 'live-trip-map' | 'official-map'
  >('home');
  const [settingsFocus, setSettingsFocus] = useState<SettingsFocusSection>();
  const [settings, setSettings] = useState<UserSettings>(defaults);
  const [classes, setClasses] = useState<ClassEvent[]>([]);
  const [snapshot, setSnapshot] = useState<GtfsSnapshot>();
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gtfsError, setGtfsError] = useState('');
  const [notificationScheduled, setNotificationScheduled] = useState(false);
  const [realtimeSnapshot, setRealtimeSnapshot] = useState<RealtimeSnapshot>();
  const [translocAlerts, setTranslocAlerts] = useState<TransitAlert[]>([]);
  const [parkingAlerts, setParkingAlerts] = useState<TransitAlert[]>([]);
  const [now, setNow] = useState(() => new Date());
  const contentRef = useRef<HTMLElement>(null);
  const lastKnownGoodRef = useRef<LiveTripProgress | undefined>(undefined);
  const realtimeCache = useMemo(() => new RealtimeSnapshotCache(campus.realtime), []);
  const homeScrollTopRef = useRef<number>(0);

  const handleContentScroll = () => {
    if (tab === 'home' && contentRef.current) {
      homeScrollTopRef.current = contentRef.current.scrollTop;
    }
  };

  const changeTab = useCallback(
    (nextTab: typeof tab) => {
      if (nextTab === tab) {
        if (tab === 'home' && contentRef.current) {
          contentRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
          homeScrollTopRef.current = 0;
        }
        return;
      }
      if (tab === 'home' && contentRef.current) {
        homeScrollTopRef.current = contentRef.current.scrollTop;
      }
      if (nextTab !== 'home' && tab === 'home') {
        window.history.pushState({ tab: nextTab }, '');
      } else if (nextTab === 'home' && window.history.state?.tab) {
        window.history.replaceState({ tab: 'home' }, '');
      }
      setTab(nextTab);
    },
    [tab],
  );

  // Support Android system back button / back gesture and browser history
  useEffect(() => {
    const handleBackButton = (e: Event) => {
      if (tab !== 'home') {
        e.preventDefault();
        setTab('home');
      }
    };
    window.addEventListener('appBackButton', handleBackButton);

    const handlePopState = (e: PopStateEvent) => {
      const nextTab = (e.state?.tab as typeof tab | undefined) ?? 'home';
      setTab(nextTab);
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('appBackButton', handleBackButton);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [tab]);

  useEffect(() => {
    if (tab === 'home') {
      if (homeScrollTopRef.current > 0 && contentRef.current) {
        contentRef.current.scrollTo({ top: homeScrollTopRef.current, left: 0 });
      }
    } else if (tab === 'week' || tab === 'alerts' || tab === 'settings') {
      contentRef.current?.scrollTo({ top: 0, left: 0 });
    }
  }, [tab]);

  /**
   * Settings deep link from the home screen. Only `main` is scrolled, and only vertically:
   * `scrollIntoView` moved every scrollable ancestor and the visual viewport, which shifted the
   * whole shell and clipped the topbar and the content edges.
   */
  useEffect(() => {
    if (tab !== 'settings' || !settingsFocus) return;
    const container = contentRef.current;
    if (!container) return;
    const frame = window.requestAnimationFrame(() => {
      const target = container.querySelector<HTMLElement>(
        `[data-settings-section="${settingsFocus}"]`,
      );
      if (!target) return;
      const containerRect = container.getBoundingClientRect();
      container.scrollTo({
        top: settingsScrollTop({
          targetTop: target.getBoundingClientRect().top,
          containerTop: containerRect.top,
          containerScrollTop: container.scrollTop,
          containerScrollHeight: container.scrollHeight,
          containerClientHeight: container.clientHeight,
        }),
        left: 0,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [settingsFocus, tab]);

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
    void Promise.all([loadSettings(defaults), loadClasses(), loadCachedAlerts()]).then(
      ([storedSettings, storedClasses, cachedAlerts]) => {
        setSettings(
          campus.migrateSettings?.(storedSettings) ?? {
            ...storedSettings,
            homeTransit:
              campus.migrateHomeTransit?.(storedSettings.homeTransit) ?? storedSettings.homeTransit,
          },
        );
        setClasses(storedClasses);
        setTranslocAlerts(cachedAlerts.filter((alert) => alert.source === 'transloc'));
        setParkingAlerts(cachedAlerts.filter((alert) => alert.source === 'parking-rss'));
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

  const translocAlertSource = useMemo(() => new DukeTranslocAlertSource(), []);
  const parkingAlertSource = useMemo(() => new DukeParkingRssSource(), []);
  const alertCatalog = useMemo(
    () => (snapshot ? buildDukeAlertCatalog(snapshot.feed) : DUKE_EMPTY_ALERT_CATALOG),
    [snapshot],
  );

  // Alerts refresh on their own cadence, independent of the 5s vehicle polling.
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const fetched = await translocAlertSource.fetch(
          alertCatalog,
          new Date(),
          controller.signal,
        );
        if (!disposed) setTranslocAlerts(fetched);
      } catch {
        // Keep the last good alerts while the upstream feed is unreachable.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5 * 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [alertCatalog, translocAlertSource]);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const fetched = await parkingAlertSource.fetch(alertCatalog, new Date(), controller.signal);
        if (!disposed) setParkingAlerts(fetched);
      } catch {
        // Browser builds cannot read the CORS-less RSS feed; Android uses native HTTP.
        // A failure here must not block the other alert sources.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20 * 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [alertCatalog, parkingAlertSource]);

  const alerts = useMemo(
    () => [...translocAlerts, ...parkingAlerts],
    [translocAlerts, parkingAlerts],
  );

  useEffect(() => {
    if (!hydrated) return;
    void saveCachedAlerts(alerts);
  }, [alerts, hydrated]);

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
    const family = campus.routeFamilies?.find((f) => f.id === settings.homeTransit?.routeFamilyId);
    if (!family) {
      return getDownstreamStops(
        snapshot.feed,
        settings.homeTransit.routeId,
        settings.homeTransit.originStopId,
      ).some((stop) => stop.id === configuredDestinationStopId)
        ? configuredDestinationStopId
        : undefined;
    }
    for (const routeId of family.routeIds) {
      const originId = mapFamilyStopToVariant(
        family.id,
        settings.homeTransit.originStopId,
        routeId,
      );
      const destId = mapFamilyStopToVariant(family.id, configuredDestinationStopId, routeId);
      if (!originId || !destId) continue;
      if (getDownstreamStops(snapshot.feed, routeId, originId).some((stop) => stop.id === destId)) {
        return configuredDestinationStopId;
      }
    }
    return undefined;
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
  const transitSelectionsRef = useRef<TransitSelection[]>([]);
  const transitSelections = useMemo(() => {
    if (!transitSelection || !snapshot || !nextClass) return [];
    const resolved = campus.resolveTransitSelections
      ? campus.resolveTransitSelections(
          transitSelection,
          snapshot.feed,
          nextClass.startTime,
          settings.homeTransit?.routeFamilyId,
          realtimeSnapshot,
        )
      : [transitSelection];
    if (areTransitSelectionsEqual(transitSelectionsRef.current, resolved)) {
      return transitSelectionsRef.current;
    }
    transitSelectionsRef.current = resolved;
    return resolved;
  }, [
    nextClass,
    realtimeSnapshot,
    settings.homeTransit?.routeFamilyId,
    snapshot,
    transitSelection,
  ]);

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
  const recommendedRouteName = recommended
    ? routeName(recommended.route.id, recommended.route.shortName || recommended.route.longName)
    : '';

  const arrivalStatusFor = useCallback(
    (recommendation: CommuteRecommendation) =>
      arrivalStatus(recommendation.minutesEarly, settings.defaultBufferMinutes),
    [settings.defaultBufferMinutes],
  );

  /**
   * The next departures after the recommended one. These can arrive after the class bell, so the
   * cards label them instead of presenting them as safe (see `arrivalStatus`).
   */
  const nextDepartures = useMemo(() => {
    const feed = snapshot?.feed;
    if (!feed || !nextClass || !recommended) return [];
    const collected = transitSelections.flatMap((selection) => {
      const originStop = feed.stops.find((stop) => stop.id === selection.originStopId);
      const destinationStop = feed.stops.find((stop) => stop.id === selection.destinationStopId);
      if (!originStop || !destinationStop) return [];
      return getFollowingDepartures(
        {
          feed,
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
        },
        { afterDeparture: recommended.departureTime, count: 2 },
      );
    });
    const seen = new Set<string>();
    return collected
      .sort((left, right) => left.departureTime.getTime() - right.departureTime.getTime())
      .filter((entry) => {
        const key = `${entry.route.id}:${entry.originStop.id}:${entry.destinationStop.id}:${entry.departureTime.toISOString()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 2);
  }, [destinationBuilding, nextClass, recommended, settings, snapshot, transitSelections]);

  /** Earlier backups (oldest first) followed by the next departures, in one time-ordered list. */
  const alternatives = useMemo(
    () => buildAlternativeList({ earlier: visibleRecommendations.slice(1), next: nextDepartures }),
    [nextDepartures, visibleRecommendations],
  );

  const classStopLabel = useMemo(() => {
    if (!configuredDestinationStopId) return undefined;
    const familyStop = findFamilyStopByStopId(
      settings.homeTransit?.routeFamilyId,
      configuredDestinationStopId,
    );
    if (familyStop) return familyStop.name;
    return (
      snapshot?.feed.stops.find((stop) => stop.id === configuredDestinationStopId)?.name ??
      configuredDestinationStopId
    );
  }, [configuredDestinationStopId, settings.homeTransit?.routeFamilyId, snapshot]);

  const familyRouteIdsFor = useCallback((routeId?: string) => {
    if (!routeId) return [];
    const family = campus.routeFamilies?.find((entry) => entry.routeIds.includes(routeId));
    return family ? family.routeIds : [routeId];
  }, []);

  const buildAlertContext = useCallback(
    (scope: AlertNotificationScope) =>
      mergeAlertNotificationContext({
        scope,
        savedRouteIds: familyRouteIdsFor(settings.homeTransit?.routeId),
        savedStopIds: [settings.homeTransit?.originStopId, configuredDestinationStopId],
        commuteRouteIds: familyRouteIdsFor(recommended?.route.id),
        commuteStopIds: recommended
          ? [recommended.originStop.id, recommended.destinationStop.id]
          : [],
      }),
    [configuredDestinationStopId, familyRouteIdsFor, recommended, settings.homeTransit],
  );

  /** `active` is recomputed against the current clock so cached alerts cannot go stale. */
  const alertsWithFreshStatus = useMemo(
    () => alerts.map((alert) => withActiveStatus(alert, now)),
    [alerts, now],
  );
  const activeAlerts = useMemo(
    () => sortAlertsForDisplay(alertsWithFreshStatus.filter((alert) => alert.active)),
    [alertsWithFreshStatus],
  );
  const alertRelevanceContext = useMemo(() => buildAlertContext('my-routes'), [buildAlertContext]);
  /** Alerts related to the next trip first, then the rest of the active alerts. */
  const homeAlerts = useMemo(() => {
    const related = activeAlerts.filter((alert) =>
      alertMatchesContext(alert, alertRelevanceContext),
    );
    const relatedIds = new Set(related.map((alert) => alert.id));
    return [...related, ...activeAlerts.filter((alert) => !relatedIds.has(alert.id))];
  }, [activeAlerts, alertRelevanceContext]);

  const recommendedAlertBadge = useMemo(() => {
    if (!recommended) return undefined;
    const kind = alertKindForRoute(activeAlerts, recommended.route.id);
    return kind ? alertKindLabel(kind, settings.language) : undefined;
  }, [activeAlerts, recommended, settings.language]);

  const weekPlanAlertBadge = useCallback(
    (routeId: string) => {
      const kind = alertKindForRoute(activeAlerts, routeId);
      return kind ? alertKindLabel(kind, settings.language) : undefined;
    },
    [activeAlerts, settings.language],
  );

  const notifyScope = settings.alertNotifications ?? 'my-routes';
  const alertNotificationContext = useMemo(
    () => buildAlertContext(notifyScope),
    [buildAlertContext, notifyScope],
  );

  const alertNotifyStateRef = useRef<AlertNotificationState | undefined>(undefined);
  const alertNotifyInFlightRef = useRef(false);
  useEffect(() => {
    if (!hydrated || alertNotifyInFlightRef.current) return;
    if (!alertsWithFreshStatus.some((alert) => alert.active)) return;
    alertNotifyInFlightRef.current = true;
    void (async () => {
      try {
        if (!alertNotifyStateRef.current) {
          alertNotifyStateRef.current = await loadAlertNotificationState();
        }
        const candidates = selectNotifiableAlerts(alertsWithFreshStatus, alertNotificationContext);
        const plan = selectAlertsToNotify(candidates, alertNotifyStateRef.current, new Date());
        if (plan.toNotify.length === 0) return;
        const scheduled = await scheduleAlertNotifications(plan.toNotify, settings.language);
        if (scheduled > 0) {
          alertNotifyStateRef.current = plan.nextState;
          await saveAlertNotificationState(plan.nextState);
        }
      } finally {
        alertNotifyInFlightRef.current = false;
      }
    })();
  }, [alertNotificationContext, alertsWithFreshStatus, hydrated, settings.language]);

  const activeTripKey = `${recommended?.route.id ?? ''}:${recommended?.originStop.id ?? ''}:${recommended?.destinationStop.id ?? ''}`;
  useEffect(() => {
    lastKnownGoodRef.current = undefined;
  }, [activeTripKey]);

  useEffect(() => {
    const isRealtimeActive =
      (tab === 'home' || tab === 'live-trip-map') &&
      Boolean(recommended) &&
      campus.realtime.available;
    if (!isRealtimeActive) return;

    let disposed = false;
    let inFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      if (inFlight) return;
      inFlight = true;
      try {
        const value = await realtimeCache.refresh(controller.signal);
        if (!disposed) {
          setRealtimeSnapshot((prev) => (isRealtimeSnapshotIdentical(prev, value) ? prev : value));
        }
      } catch {
        // Keep existing snapshot on transient network failure
      } finally {
        inFlight = false;
      }
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [realtimeCache, recommended, tab]);

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
    const currentTime = new Date();
    const raw = calculateLiveTripProgress({
      snapshot: realtimeSnapshot,
      routeId: recommended.route.id,
      boardingStopId: recommended.originStop.id,
      arrivalStopId: recommended.destinationStop.id,
      now: currentTime,
    });
    const { progress, nextLastKnownGood } = applyLiveTripFallback(
      raw,
      lastKnownGoodRef.current,
      currentTime,
    );
    lastKnownGoodRef.current = nextLastKnownGood;
    return progress;
  }, [realtimeSnapshot, recommended]);

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

  const lastScheduledKeyRef = useRef<string>('');
  useEffect(() => {
    if (!nextClass || !recommended) {
      lastScheduledKeyRef.current = '';
      setNotificationScheduled(false);
      return;
    }
    const scheduleKey = `${nextClass.id}:${recommended.trip.id}:${recommended.departureTime.getTime()}:${recommended.leaveAt.getTime()}:${recommendedRouteName}:${settings.language}`;
    if (lastScheduledKeyRef.current === scheduleKey) {
      return;
    }
    lastScheduledKeyRef.current = scheduleKey;
    let cancelled = false;
    void scheduleCommuteNotification(
      nextClass,
      recommended,
      settings.language,
      recommendedRouteName,
    ).then((scheduled) => {
      if (!cancelled) {
        setNotificationScheduled(scheduled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [nextClass, recommended, recommendedRouteName, settings.language]);

  const importClasses = (events: ClassEvent[]) => {
    setClasses(events);
    void saveClasses(events);
  };

  const openSettingsAt = useCallback(
    (focus: SettingsFocusSection) => {
      setSettingsFocus(focus);
      changeTab('settings');
    },
    [changeTab],
  );

  // Leaving Settings drops the deep-link target so the next visit starts at the top.
  useEffect(() => {
    if (tab !== 'settings') setSettingsFocus(undefined);
  }, [tab]);

  /** Read-only arrival stop for the next class; editing lives in Settings. */
  const classStopRow =
    snapshot && settings.homeTransit?.routeId && settings.homeTransit.originStopId ? (
      <button
        className="class-stop-row"
        type="button"
        onClick={() => openSettingsAt('class-stops')}
      >
        <span>{translate(settings.language, 'getOffAt')}</span>
        <strong>{classStopLabel ?? translate(settings.language, 'selectArrivalStop')}</strong>
        <span aria-hidden="true">→</span>
      </button>
    ) : null;

  const isMapOpen = tab === 'live-trip-map' || tab === 'official-map';

  return (
    <>
      <div className="app-shell" aria-hidden={isMapOpen ? 'true' : undefined}>
        <header className="topbar">
          <div className="brand-mark">CCA</div>
          <div>
            <strong>Campus Commute</strong>
            <span>{campus.config.name}</span>
          </div>
          <button
            className="icon-button"
            aria-label={translate(settings.language, 'openSettings')}
            onClick={() => changeTab('settings')}
          >
            ⚙
          </button>
        </header>

        <main ref={contentRef} onScroll={handleContentScroll}>
          {tab === 'home' || isMapOpen ? (
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
                    <div className="notice-banner">
                      <strong>{translate(settings.language, 'walkNotIncluded')}</strong>
                      <button className="secondary-button" onClick={() => setTab('settings')}>
                        {translate(settings.language, 'setHomeLocation')}
                      </button>
                    </div>
                  )}

                  {!snapshot && (
                    <div className="notice-banner">
                      <strong>
                        {translate(
                          settings.language,
                          refreshing ? 'loadingTransit' : 'transitUnavailable',
                        )}
                      </strong>
                      <span>{gtfsError || translate(settings.language, 'firstDownload')}</span>
                      {!refreshing && (
                        <button className="secondary-button" onClick={() => void refreshGtfs(true)}>
                          {translate(settings.language, 'tryAgain')}
                        </button>
                      )}
                    </div>
                  )}

                  {snapshot &&
                    (!settings.homeTransit?.routeId || !settings.homeTransit.originStopId) && (
                      <div className="notice-banner">
                        <strong>{translate(settings.language, 'chooseHomeStop')}</strong>
                        <button className="secondary-button" onClick={() => setTab('settings')}>
                          {translate(settings.language, 'configureHomeTransit')}
                        </button>
                      </div>
                    )}

                  {snapshot && transitSelection && recommendations.length === 0 && (
                    <div className="notice-banner warning-card">
                      <strong>{translate(settings.language, 'noMatchingDeparture')}</strong>
                      <span>{translate(settings.language, 'noMatchingDepartureHint')}</span>
                    </div>
                  )}

                  {recommended && (
                    <>
                      <RecommendationCard
                        language={settings.language}
                        recommendation={recommended}
                        routeName={recommendedRouteName}
                        badge={recommendedAlertBadge}
                        arrivalStatus={arrivalStatusFor(recommended)}
                      />
                      {classStopRow}
                      <LiveRouteOverlay
                        language={settings.language}
                        routeName={recommendedRouteName}
                        progress={liveTripProgress}
                        onOpen={() => changeTab('live-trip-map')}
                      />
                      <AlertsSummary
                        language={settings.language}
                        alerts={homeAlerts}
                        onOpen={() => changeTab('alerts')}
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
                              recommendation={alternative}
                              routeName={routeName(
                                alternative.route.id,
                                alternative.route.shortName || alternative.route.longName,
                              )}
                              badge={weekPlanAlertBadge(alternative.route.id)}
                              arrivalStatus={arrivalStatusFor(alternative)}
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
                            onClick={() => changeTab('official-map')}
                          >
                            {translate(settings.language, 'openFullTransloc')}
                          </button>
                        )}
                        <button className="text-button" onClick={() => changeTab('settings')}>
                          {translate(settings.language, 'adjustDefaults')}
                        </button>
                      </div>
                    </>
                  )}
                  {!recommended && classStopRow}
                </>
              )}
            </>
          ) : tab === 'week' ? (
            <WeekPlan
              language={settings.language}
              plans={weekPlans}
              routeName={routeName}
              alertBadge={weekPlanAlertBadge}
              onOpenSettings={() => changeTab('settings')}
            />
          ) : tab === 'alerts' ? (
            <AlertsPanel language={settings.language} alerts={homeAlerts} routeName={routeName} />
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
              focusSection={settingsFocus}
              onSettings={setSettings}
              onImportClasses={importClasses}
              onRefresh={() => void refreshGtfs(true)}
            />
          )}
        </main>

        <nav className="bottom-nav" aria-label={translate(settings.language, 'primaryNavigation')}>
          <button className={tab === 'home' ? 'active' : ''} onClick={() => changeTab('home')}>
            <span>⌂</span>
            {translate(settings.language, 'nextTrip')}
          </button>
          <button className={tab === 'week' ? 'active' : ''} onClick={() => changeTab('week')}>
            <span>▦</span>
            {translate(settings.language, 'weekPlanNav')}
          </button>
          <button className={tab === 'alerts' ? 'active' : ''} onClick={() => changeTab('alerts')}>
            {/* U+26A0 + U+FE0E keeps the warning triangle in its monochrome text form. */}
            <span>{'\u26A0\uFE0E'}</span>
            {translate(settings.language, 'alertsNav')}
          </button>
          <button
            className={tab === 'settings' ? 'active' : ''}
            onClick={() => changeTab('settings')}
          >
            <span>⚙</span>
            {translate(settings.language, 'settings')}
          </button>
        </nav>
      </div>

      {tab === 'live-trip-map' && recommended && (
        <LiveTripMap
          language={settings.language}
          routeName={recommendedRouteName}
          progress={liveTripProgress}
          home={settings.home}
          destination={destinationBuilding}
          onClose={() => changeTab('home')}
          onOpenOfficial={() => changeTab('official-map')}
        />
      )}

      {tab === 'official-map' && campus.config.liveMapUrl && (
        <LiveTransitMap
          url={campus.config.liveMapUrl}
          language={settings.language}
          onClose={() => changeTab('home')}
        />
      )}
    </>
  );
}
