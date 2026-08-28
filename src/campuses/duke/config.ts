import type { CampusAdapter } from '../../core/types';
import { dukeBuildings } from './buildings';
import { DukeRealtimeProvider } from './realtime';
import { migrateDukeOfficialSelection, supplementDukeOfficialSchedules } from './officialSchedule';

export const dukeCampus: CampusAdapter = {
  config: {
    id: 'duke',
    name: 'Duke University',
    timezone: 'America/New_York',
    gtfsUrl: 'https://duke.transloc.com/Secure/Admin/Reports/GTFSDownload.aspx',
    developmentGtfsUrl: '/api/duke-gtfs',
    liveMapUrl: 'https://duke.transloc.com/',
    defaultBufferMinutes: 10,
    gtfsRefreshHours: 168,
  },
  buildings: dukeBuildings,
  realtime: new DukeRealtimeProvider(),
  supplementGtfs: supplementDukeOfficialSchedules,
  migrateTransitSelection: migrateDukeOfficialSelection,
};
