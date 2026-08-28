import type { CampusAdapter } from '../core/types';
import { dukeCampus } from './duke/config';

export const campuses: CampusAdapter[] = [dukeCampus];
export const defaultCampus = dukeCampus;
