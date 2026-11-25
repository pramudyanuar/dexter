import type { RoomView } from '@/lib/rooms/types';

export const BUG_DESCRIPTION_MAX = 2000;
export const BUG_REPORT_KEEP = 50;
export const BUG_DRAFT_TTL = 30 * 60;

export interface BugSnapshot {
  capturedAt: number;
  browser: string;
  room: Pick<
    RoomView,
    | 'code'
    | 'game'
    | 'status'
    | 'version'
    | 'seat'
    | 'state'
    | 'options'
    | 'joined'
    | 'out'
    | 'outWhy'
    | 'waiting'
    | 'leaving'
    | 'strikes'
    | 'host'
  >;
  stateOmitted: boolean;
}

export interface BugReport extends BugSnapshot {
  id: string;
  description: string;
  submittedAt: number;
}
