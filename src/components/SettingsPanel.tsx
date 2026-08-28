import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { useEffect, useMemo, useState } from 'react';
import { buildingBindingKey, classBindingKey } from '../core/calendar/bindings';
import type {
  AppLanguage,
  CampusBuilding,
  CampusConfig,
  CampusRouteFamily,
  ClassEvent,
  GtfsFeed,
  Location,
  UserSettings,
} from '../core/types';
import { localeFor, translate } from '../i18n';
import {
  getBatteryOptimizationStatus,
  openBatteryOptimizationSettings,
  type BatteryOptimizationStatus,
} from '../core/widgets/android';
import { HomeLocationSearch } from './HomeLocationSearch';
import { HomeMap } from './HomeMap';
import { ImportClasses } from './ImportClasses';
import { ClassDestinationField, HomeTransitSettings } from './TransitPreferences';

interface SettingsPanelProps {
  settings: UserSettings;
  campus: CampusConfig;
  buildings: CampusBuilding[];
  gtfsUpdatedAt?: Date;
  refreshing: boolean;
  feed?: GtfsFeed;
  routeFamilies?: CampusRouteFamily[];
  classes: ClassEvent[];
  onSettings(settings: UserSettings): void;
  onImportClasses(events: ClassEvent[]): void;
  onRefresh(): void;
}

function locationFailureMessage(error: unknown, language: AppLanguage): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
  if (code === '1' || code === 'OS-PLUG-GLOC-0003') {
    return translate(language, 'locationDenied');
  }
  if (
    code === 'OS-PLUG-GLOC-0007' ||
    code === 'OS-PLUG-GLOC-0009' ||
    code === 'OS-PLUG-GLOC-0017'
  ) {
    return translate(language, 'locationDisabled');
  }
  if (code === '3' || code === 'OS-PLUG-GLOC-0010') {
    return translate(language, 'locationTimedOut');
  }
  return translate(language, 'locationFailed');
}

export function SettingsPanel({
  settings,
  campus,
  buildings,
  gtfsUpdatedAt,
  refreshing,
  feed,
  routeFamilies,
  classes,
  onSettings,
  onImportClasses,
  onRefresh,
}: SettingsPanelProps) {
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>();
  const [batteryStatus, setBatteryStatus] = useState<BatteryOptimizationStatus>();
  const language = settings.language;
  const isAndroid = Capacitor.getPlatform() === 'android';
  const setHome = (home: Location) => onSettings({ ...settings, home });
  const stopBindingKey = (event: Pick<ClassEvent, 'title' | 'location'>) =>
    settings.groupClassStopsByBuilding
      ? buildingBindingKey(event, buildings)
      : classBindingKey(event);
  const uniqueClasses = [
    ...new Map(classes.map((event) => [stopBindingKey(event), event])).entries(),
  ];
  const calendarRange = useMemo(() => {
    if (classes.length === 0) return undefined;
    const sorted = [...classes].sort(
      (left, right) => left.startTime.getTime() - right.startTime.getTime(),
    );
    return { start: sorted[0]!.startTime, end: sorted[sorted.length - 1]!.startTime };
  }, [classes]);

  useEffect(() => {
    if (!isAndroid) return;
    void getBatteryOptimizationStatus()
      .then(setBatteryStatus)
      .catch(() => undefined);
  }, [isAndroid]);
  const setCurrentPosition = async () => {
    setLocating(true);
    setLocationStatus(undefined);
    try {
      if (Capacitor.isNativePlatform()) {
        let permission = await Geolocation.checkPermissions();
        if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
          permission = await Geolocation.requestPermissions({
            permissions: ['location', 'coarseLocation'],
          });
        }
        if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
          setLocationStatus(translate(language, 'locationDenied'));
          return;
        }
      }

      // On the web, getCurrentPosition invokes the browser's own permission prompt.
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 60_000,
      });
      setHome({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        label: translate(language, 'currentLocation'),
      });
      setLocationStatus(
        translate(language, 'currentLocationSaved', {
          meters: Math.round(position.coords.accuracy),
        }),
      );
    } catch (error) {
      setLocationStatus(locationFailureMessage(error, language));
    } finally {
      setLocating(false);
    }
  };

  return (
    <section className="settings-panel">
      <div className="section-heading">
        <p className="eyebrow">{translate(language, 'settings')}</p>
        <h1>{translate(language, 'commuteDefaults')}</h1>
      </div>
      <label>
        {translate(language, 'language')}
        <select
          value={language}
          onChange={(event) =>
            onSettings({ ...settings, language: event.target.value as AppLanguage })
          }
        >
          <option value="en">{translate(language, 'english')}</option>
          <option value="zh-CN">{translate(language, 'simplifiedChinese')}</option>
        </select>
      </label>
      <section className="settings-subsection calendar-settings">
        <div>
          <p className="eyebrow">{translate(language, 'calendarSection')}</p>
          <h2>{translate(language, 'courseCalendar')}</h2>
          <p className="hint">
            {translate(language, 'calendarLoaded', { count: classes.length })}
            {calendarRange && (
              <>
                {' '}
                {translate(language, 'calendarRange', {
                  start: calendarRange.start.toLocaleDateString(localeFor(language)),
                  end: calendarRange.end.toLocaleDateString(localeFor(language)),
                })}
              </>
            )}
          </p>
        </div>
        <ImportClasses
          language={language}
          mode={classes.length > 0 ? 'replace' : 'import'}
          onImport={onImportClasses}
        />
      </section>
      <section className="settings-subsection home-location-section">
        <div>
          <p className="eyebrow">{translate(language, 'homeLocation')}</p>
          <h2>{translate(language, 'commuteStarts')}</h2>
          {settings.home && (
            <p className="saved-location" title={settings.home.label}>
              {settings.home.label ||
                `${settings.home.lat.toFixed(5)}, ${settings.home.lon.toFixed(5)}`}
            </p>
          )}
        </div>

        <HomeLocationSearch language={language} onSelect={setHome} />
        <div className="location-divider">
          <span>{translate(language, 'or')}</span>
        </div>
        <button
          className="secondary-button"
          disabled={locating}
          type="button"
          onClick={() => void setCurrentPosition()}
        >
          {translate(language, locating ? 'gettingLocation' : 'useCurrentLocation')}
        </button>
        {locationStatus && <p className="location-status">{locationStatus}</p>}

        <details className="coordinate-entry">
          <summary>{translate(language, 'manualCoordinates')}</summary>
          <div className="coordinate-fields">
            <label>
              {translate(language, 'latitude')}
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={settings.home?.lat ?? ''}
                onChange={(event) =>
                  setHome({
                    lat: Number(event.target.value),
                    lon: settings.home?.lon ?? -78.9382,
                    label: translate(language, 'home'),
                  })
                }
              />
            </label>
            <label>
              {translate(language, 'longitude')}
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={settings.home?.lon ?? ''}
                onChange={(event) =>
                  setHome({
                    lat: settings.home?.lat ?? 36.0014,
                    lon: Number(event.target.value),
                    label: translate(language, 'home'),
                  })
                }
              />
            </label>
          </div>
        </details>
        <HomeMap value={settings.home} pinLabel={translate(language, 'home')} onChange={setHome} />
        <p className="hint">{translate(language, 'mapFineTune')}</p>
      </section>

      <HomeTransitSettings
        language={language}
        feed={feed}
        routeFamilies={routeFamilies}
        value={settings.homeTransit}
        onChange={(homeTransit) => onSettings({ ...settings, homeTransit })}
      />

      <section className="settings-subsection">
        <div>
          <p className="eyebrow">{translate(language, 'classArrivalStops')}</p>
          <h2>{translate(language, 'whereToGetOff')}</h2>
          <p className="hint">
            {translate(
              language,
              settings.groupClassStopsByBuilding
                ? 'eachBuildingConfigured'
                : 'eachCourseConfigured',
            )}
          </p>
        </div>
        <label className="experimental-toggle">
          <span>
            <strong>{translate(language, 'experimental')}</strong>
            {translate(language, 'groupRooms')}
          </span>
          <input
            type="checkbox"
            checked={settings.groupClassStopsByBuilding}
            onChange={(event) =>
              onSettings({ ...settings, groupClassStopsByBuilding: event.target.checked })
            }
          />
        </label>
        <p className="hint">{translate(language, 'groupRoomsHint')}</p>
        {!settings.homeTransit?.routeId || !settings.homeTransit.originStopId ? (
          <p className="hint">{translate(language, 'chooseHomeFirst')}</p>
        ) : !feed ? (
          <p className="hint">{translate(language, 'scheduleLoading')}</p>
        ) : uniqueClasses.length === 0 ? (
          <p className="hint">{translate(language, 'importToConfigure')}</p>
        ) : (
          <div className="class-binding-list">
            {uniqueClasses.map(([key, event]) => (
              <ClassDestinationField
                key={key}
                feed={feed}
                routeId={settings.homeTransit!.routeId!}
                originStopId={settings.homeTransit!.originStopId!}
                classEvent={event}
                language={language}
                sharedByBuilding={settings.groupClassStopsByBuilding}
                value={
                  settings.groupClassStopsByBuilding
                    ? settings.buildingStopBindings?.[key]
                    : settings.classStopBindings?.[key]
                }
                onChange={(destinationStopId) => {
                  if (settings.groupClassStopsByBuilding) {
                    const buildingStopBindings = { ...(settings.buildingStopBindings ?? {}) };
                    if (destinationStopId) buildingStopBindings[key] = destinationStopId;
                    else delete buildingStopBindings[key];
                    onSettings({ ...settings, buildingStopBindings });
                  } else {
                    const classStopBindings = { ...(settings.classStopBindings ?? {}) };
                    if (destinationStopId) classStopBindings[key] = destinationStopId;
                    else delete classStopBindings[key];
                    onSettings({ ...settings, classStopBindings });
                  }
                }}
              />
            ))}
          </div>
        )}
      </section>

      <label>
        {translate(language, 'defaultBuffer')}
        <span className="input-with-unit">
          <input
            type="number"
            min="0"
            max="60"
            value={settings.defaultBufferMinutes}
            onChange={(event) =>
              onSettings({ ...settings, defaultBufferMinutes: Number(event.target.value) })
            }
          />
          {translate(language, 'minutesShort')}
        </span>
      </label>
      <label>
        {translate(language, 'walkingPace')}
        <select
          value={settings.walkingSpeedMetersPerSecond}
          onChange={(event) =>
            onSettings({ ...settings, walkingSpeedMetersPerSecond: Number(event.target.value) })
          }
        >
          <option value="1.05">{translate(language, 'relaxed')}</option>
          <option value="1.3">{translate(language, 'normal')}</option>
          <option value="1.55">{translate(language, 'brisk')}</option>
        </select>
      </label>
      <div className="settings-row">
        <div>
          <span className="eyebrow">{translate(language, 'gtfsSchedule')}</span>
          <strong>
            {gtfsUpdatedAt
              ? translate(language, 'updatedAt', {
                  date: gtfsUpdatedAt.toLocaleString(localeFor(language)),
                })
              : translate(language, 'notDownloaded')}
          </strong>
        </div>
        <button className="secondary-button" disabled={refreshing} onClick={onRefresh}>
          {translate(language, refreshing ? 'refreshing' : 'refresh')}
        </button>
      </div>
      <div className="settings-row">
        <span>{translate(language, 'campus')}</span>
        <strong>{campus.name}</strong>
      </div>
      {isAndroid && (
        <section className="settings-subsection android-tools">
          <div>
            <p className="eyebrow">{translate(language, 'androidTools')}</p>
            <h2>{translate(language, 'homeScreenWidgets')}</h2>
            <p className="hint">{translate(language, 'widgetsHint')}</p>
          </div>
          <div className="battery-settings">
            <strong>{translate(language, 'batteryOptimization')}</strong>
            <p className="hint">{translate(language, 'batteryOptimizationHint')}</p>
            <p className="battery-status">
              {translate(
                language,
                !batteryStatus?.supported
                  ? 'batteryStatusUnavailable'
                  : batteryStatus.exempt
                    ? 'batteryExempt'
                    : 'batteryManaged',
              )}
            </p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void openBatteryOptimizationSettings()}
            >
              {translate(language, 'openBatterySettings')}
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
