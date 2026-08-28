export interface Coordinates {
  lat: number;
  lon: number;
}

export type AppLanguage = 'en' | 'zh-CN';

export interface Location extends Coordinates {
  label?: string;
}

export interface ClassEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location: string;
}

export interface Campus {
  id: string;
  name: string;
  timezone: string;
}

export interface CampusConfig extends Campus {
  gtfsUrl: string;
  developmentGtfsUrl?: string;
  liveMapUrl?: string;
  defaultBufferMinutes: number;
  gtfsRefreshHours: number;
}

export interface CampusBuilding extends Location {
  id: string;
  name: string;
  aliases: string[];
}

export interface Stop extends Location {
  id: string;
  name: string;
  code?: string;
}

export interface TransitRoute {
  id: string;
  shortName: string;
  longName: string;
  type: number;
  color?: string;
  textColor?: string;
}

export interface Trip {
  id: string;
  routeId: string;
  serviceId: string;
  headsign?: string;
  directionId?: number;
  shapeId?: string;
  scheduleSource?: {
    kind: 'official-supplement';
    label: string;
    url: string;
    verifiedOn: string;
    includesEstimatedStopTimes?: boolean;
  };
}

export interface StopTime {
  tripId: string;
  stopId: string;
  arrivalSeconds: number;
  departureSeconds: number;
  stopSequence: number;
  timingSource?: 'published' | 'interpolated';
}

export interface FrequencyEntry {
  tripId: string;
  startSeconds: number;
  endSeconds: number;
  headwaySeconds: number;
  exactTimes: 0 | 1;
}

export interface ServiceCalendar {
  serviceId: string;
  weekdays: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  startDate: string;
  endDate: string;
}

export interface ServiceException {
  serviceId: string;
  date: string;
  exceptionType: 1 | 2;
}

export interface ShapePoint extends Location {
  shapeId: string;
  sequence: number;
}

export interface GtfsFeed {
  stops: Stop[];
  routes: TransitRoute[];
  trips: Trip[];
  stopTimes: StopTime[];
  frequencies: FrequencyEntry[];
  calendars: ServiceCalendar[];
  calendarDates: ServiceException[];
  shapes: ShapePoint[];
}

export interface VehiclePosition extends Location {
  vehicleId: string;
  routeId?: string;
  tripId?: string;
  bearing?: number;
  recordedAt: Date;
}

export interface ArrivalPrediction {
  stopId: string;
  routeId?: string;
  tripId?: string;
  scheduledTime?: Date;
  estimatedTime: Date;
}

export interface RealtimeProvider {
  readonly available: boolean;
  getVehiclePositions(): Promise<VehiclePosition[]>;
  getArrivalPredictions(stopId: string): Promise<ArrivalPrediction[]>;
}

export interface CommuteRequest {
  origin: Location;
  destination: Location;
  arrivalDeadline: Date;
  bufferMinutes: number;
}

export interface CommuteRecommendation {
  kind: 'transit';
  leaveAt: Date;
  originStop: Stop;
  destinationStop: Stop;
  route: TransitRoute;
  trip: Trip;
  departureTime: Date;
  departureTimeIsExact: boolean;
  frequencyHeadwayMinutes?: number;
  arrivalTime: Date;
  walkingMinutes: number;
  waitingMinutes: number;
  originWalkingMinutes: number;
  destinationWalkingMinutes: number;
  transitMinutes: number;
  totalMinutes: number;
  minutesEarly: number;
  confidence: 'high' | 'medium' | 'low';
}

export type CommutePlanStatus =
  | 'ready'
  | 'schedule-loading'
  | 'home-transit-missing'
  | 'arrival-stop-missing'
  | 'no-matching-departure';

export interface CommutePlan {
  classEvent: ClassEvent;
  status: CommutePlanStatus;
  recommendation?: CommuteRecommendation;
}

export interface RoutingOptions {
  feed: GtfsFeed;
  request: CommuteRequest;
  transitSelection: TransitSelection;
  serviceTimezone: string;
  walkingSpeedMetersPerSecond: number;
  walkingCorrectionFactor: number;
}

export interface TransitSelection {
  routeId: string;
  originStopId: string;
  destinationStopId: string;
}

export interface TransitSelectionDraft {
  routeId?: string;
  originStopId?: string;
  destinationStopId?: string;
}

export interface HomeTransitDraft {
  routeId?: string;
  originStopId?: string;
}

export interface UserSettings {
  campusId: string;
  language: AppLanguage;
  home?: Location;
  defaultBufferMinutes: number;
  walkingSpeedMetersPerSecond: number;
  walkingCorrectionFactor: number;
  homeTransit?: HomeTransitDraft;
  classStopBindings?: Record<string, string>;
  groupClassStopsByBuilding: boolean;
  buildingStopBindings?: Record<string, string>;
  /** Legacy v0.1 selection, migrated on load. */
  transitSelection?: TransitSelectionDraft;
}

export interface CampusAdapter {
  config: CampusConfig;
  buildings: CampusBuilding[];
  realtime: RealtimeProvider;
  supplementGtfs?(feed: GtfsFeed): GtfsFeed;
  migrateTransitSelection?(selection?: TransitSelectionDraft): TransitSelectionDraft | undefined;
}
