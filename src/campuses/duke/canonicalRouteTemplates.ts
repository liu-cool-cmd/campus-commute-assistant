/**
 * Canonical route stop sequence and inter-stop estimated offset templates.
 *
 * NOTE: The inter-stop travel seconds are derived from TransLoc live map geometry
 * (`SecondsToNextStop`). They provide the baseline stop sequence and relative timing
 * offsets for routes that lack static GTFS schedules. Stop times for non-checkpoint
 * stops calculated with these templates are ESTIMATED (interpolated), whereas
 * official checkpoint stop times remain authoritative.
 */

export interface CanonicalRouteStop {
  stopId: string;
  name: string;
  secondsFromStart: number;
}

export const canonicalRouteTemplates: Record<string, CanonicalRouteStop[]> = {
  // TL-4: LL: LaSalle Loop (Clockwise Day) - 20 stops
  'TL-4': [
    { stopId: 'TL-23', name: 'The Heights at LaSalle', secondsFromStart: 0 },
    { stopId: 'TL-24', name: 'LaSalle at Campus Walk (Southbound)', secondsFromStart: 60 },
    { stopId: 'TL-25', name: 'Lasalle St at Bradford Ridge Apts', secondsFromStart: 120 },
    { stopId: 'TL-26', name: 'LaSalle St at Circuit Lot (12102)', secondsFromStart: 180 },
    { stopId: 'TL-27', name: 'Circuit Dr at North Building (12103)', secondsFromStart: 240 },
    { stopId: 'TL-28', name: 'Research Dr at North Bldg', secondsFromStart: 300 },
    { stopId: 'TL-29', name: 'Research Dr at LSRC Bldg (Southbound)', secondsFromStart: 360 },
    { stopId: 'TL-30', name: 'Research Dr at Hudson Hall (Southbound)', secondsFromStart: 420 },
    { stopId: 'TL-31', name: 'Research Dr at Duke Clinic (12030)', secondsFromStart: 480 },
    {
      stopId: 'TL-99',
      name: 'Research Dr at Nanaline Duke Bldg (Northbound)',
      secondsFromStart: 540,
    },
    { stopId: 'TL-100', name: 'Circuit Dr at Circuit Lot (Westbound)', secondsFromStart: 600 },
    {
      stopId: 'TL-101',
      name: 'Circuit Drive at Circuit Lot Extension (Westbound)',
      secondsFromStart: 660,
    },
    { stopId: 'TL-155', name: 'Circuit Dr at Towerview Rd (12067)', secondsFromStart: 720 },
    { stopId: 'TL-156', name: 'Morreene Rd at Erwin Rd (NB)', secondsFromStart: 780 },
    { stopId: 'TL-104', name: 'Morreene Rd at Sherwood Dr', secondsFromStart: 840 },
    { stopId: 'TL-224', name: 'Morreene Rd at Campus Walk Ave (NB)(12068)', secondsFromStart: 900 },
    { stopId: 'TL-106', name: 'Millenium Campus Walk East', secondsFromStart: 960 },
    { stopId: 'TL-107', name: 'Holly Ridge/Campus Walk East', secondsFromStart: 1020 },
    { stopId: 'TL-108', name: 'Campus Walk Ave at LaSalle St (12109)', secondsFromStart: 1080 },
    {
      stopId: 'TL-109',
      name: 'LaSalle St at Belmont Apartments (Northbound)',
      secondsFromStart: 1140,
    },
  ],

  // TL-17: LLN: LaSalle Loop Night (Clockwise Night) - 21 stops
  'TL-17': [
    { stopId: 'TL-253', name: 'The Heights at LaSalle', secondsFromStart: 0 },
    { stopId: 'TL-158', name: 'Circuit Dr at North Building (12103)', secondsFromStart: 60 },
    { stopId: 'TL-159', name: 'Research Dr at LSRC Bldg (Southbound)', secondsFromStart: 120 },
    { stopId: 'TL-160', name: 'Research Dr at Hudson Hall (Southbound)', secondsFromStart: 180 },
    { stopId: 'TL-161', name: 'Research Dr at Duke Clinic (12030)', secondsFromStart: 240 },
    {
      stopId: 'TL-162',
      name: 'Research Dr at Nanaline Duke Bldg (Northbound)',
      secondsFromStart: 300,
    },
    { stopId: 'TL-163', name: 'Research Dr at North Bldg', secondsFromStart: 360 },
    { stopId: 'TL-164', name: 'Research Dr at GSRB Bldg (Northbound)', secondsFromStart: 420 },
    {
      stopId: 'TL-165',
      name: 'Research Dr at Erwin Rd (Research Drive Garage)',
      secondsFromStart: 480,
    },
    { stopId: 'TL-166', name: 'Erwin Rd at LaSalle St (Westbound)', secondsFromStart: 540 },
    { stopId: 'TL-167', name: 'LaSalle St at Circuit Lot (12102)', secondsFromStart: 600 },
    { stopId: 'TL-168', name: 'Circuit Dr at Circuit Lot (Westbound)', secondsFromStart: 660 },
    { stopId: 'TL-169', name: 'Circuit Dr at Towerview Rd (12067)', secondsFromStart: 720 },
    { stopId: 'TL-170', name: 'Morreene Rd at Erwin Rd (NB)', secondsFromStart: 780 },
    { stopId: 'TL-171', name: 'Morreene Rd at Sherwood Dr', secondsFromStart: 840 },
    { stopId: 'TL-172', name: 'Morreene Rd at Campus Walk Ave (NB)(12068)', secondsFromStart: 900 },
    { stopId: 'TL-173', name: 'Millenium Campus Walk East', secondsFromStart: 960 },
    { stopId: 'TL-174', name: 'Holly Ridge/Campus Walk East', secondsFromStart: 1020 },
    { stopId: 'TL-175', name: 'Campus Walk Ave at LaSalle St (12109)', secondsFromStart: 1080 },
    { stopId: 'TL-176', name: 'LaSalle at Campus Walk (Southbound)', secondsFromStart: 1140 },
    {
      stopId: 'TL-177',
      name: 'LaSalle St at Belmont Apartments (Northbound)',
      secondsFromStart: 1200,
    },
  ],

  // TL-13: LLCCW: LaSalle Loop Counterclockwise (Day) - 16 stops
  'TL-13': [
    { stopId: 'TL-90', name: 'The Heights at LaSalle', secondsFromStart: 0 },
    { stopId: 'TL-188', name: 'LaSalle at Campus Walk (Southbound)', secondsFromStart: 29 },
    { stopId: 'TL-189', name: 'Campus Walk Avenue at Campus Walk', secondsFromStart: 51 },
    {
      stopId: 'TL-190',
      name: 'Morreene Rd at Campus Walk Ave (SB) (12069)',
      secondsFromStart: 105,
    },
    { stopId: 'TL-278', name: 'Morreene Rd at Sherwood Dr (SB)', secondsFromStart: 121 },
    { stopId: 'TL-192', name: 'Morreene Rd at Erwin Rd (SB)', secondsFromStart: 151 },
    { stopId: 'TL-193', name: 'Towerview at Circuit Dr', secondsFromStart: 230 },
    { stopId: 'TL-195', name: 'Circuit Dr at F.E.L. Labs Bldg (Eastbound)', secondsFromStart: 300 },
    { stopId: 'TL-196', name: 'Circuit Dr at LaSalle St (Eastbound)', secondsFromStart: 321 },
    { stopId: 'TL-197', name: 'Circuit Dr at North Building (12103)', secondsFromStart: 350 },
    { stopId: 'TL-198', name: 'Research Dr at LSRC Bldg (Southbound)', secondsFromStart: 378 },
    { stopId: 'TL-199', name: 'Research Dr at Hudson Hall (Southbound)', secondsFromStart: 410 },
    { stopId: 'TL-200', name: 'Research Dr at Duke Clinic (12030)', secondsFromStart: 480 },
    {
      stopId: 'TL-201',
      name: 'Research Dr at Nanaline Duke Bldg (Northbound)',
      secondsFromStart: 558,
    },
    { stopId: 'TL-202', name: 'LaSalle St at Circuit Lot (12102)', secondsFromStart: 629 },
    {
      stopId: 'TL-203',
      name: 'LaSalle St at Belmont Apartments (Northbound)',
      secondsFromStart: 843,
    },
  ],

  // TL-19: LLCCWN: LaSalle Loop Counterclockwise Night - 18 stops
  'TL-19': [
    { stopId: 'TL-205', name: 'The Heights at LaSalle', secondsFromStart: 0 },
    { stopId: 'TL-206', name: 'LaSalle at Campus Walk (Southbound)', secondsFromStart: 60 },
    { stopId: 'TL-207', name: 'Campus Walk Avenue at Campus Walk', secondsFromStart: 120 },
    {
      stopId: 'TL-208',
      name: 'Morreene Rd at Campus Walk Ave (SB) (12069)',
      secondsFromStart: 180,
    },
    { stopId: 'TL-279', name: 'Morreene Rd at Sherwood Dr (SB) (2)', secondsFromStart: 240 },
    { stopId: 'TL-210', name: 'Morreene Rd at Erwin Rd (SB)', secondsFromStart: 300 },
    { stopId: 'TL-211', name: 'Towerview at Circuit Dr', secondsFromStart: 360 },
    { stopId: 'TL-212', name: 'Circuit Dr at F.E.L. Labs Bldg (Eastbound)', secondsFromStart: 420 },
    { stopId: 'TL-213', name: 'Circuit Dr at LaSalle St (Eastbound)', secondsFromStart: 480 },
    { stopId: 'TL-214', name: 'Circuit Dr at North Building (12103)', secondsFromStart: 540 },
    { stopId: 'TL-215', name: 'Research Dr at Hudson Hall (Southbound)', secondsFromStart: 600 },
    { stopId: 'TL-216', name: 'Research Dr at Duke Clinic (12030)', secondsFromStart: 660 },
    {
      stopId: 'TL-217',
      name: 'Research Dr at Nanaline Duke Bldg (Northbound)',
      secondsFromStart: 720,
    },
    { stopId: 'TL-218', name: 'Research Dr at North Bldg', secondsFromStart: 780 },
    { stopId: 'TL-219', name: 'Research Dr at GSRB Bldg (Northbound)', secondsFromStart: 840 },
    {
      stopId: 'TL-220',
      name: 'Research Dr at Erwin Rd (Research Drive Garage)',
      secondsFromStart: 900,
    },
    { stopId: 'TL-221', name: 'Erwin Rd at LaSalle St (Westbound)', secondsFromStart: 960 },
    {
      stopId: 'TL-222',
      name: 'LaSalle St at Belmont Apartments (Northbound)',
      secondsFromStart: 1020,
    },
  ],
};
