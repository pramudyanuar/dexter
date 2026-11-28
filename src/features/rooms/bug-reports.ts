import type { RoomView } from '@/features/rooms/types';

export const BUG_DESCRIPTION_MAX = 2000;
export const BUG_REPORT_KEEP = 50;
export const BUG_DRAFT_TTL = 30 * 60;
export const ROOM_BUG_REPORT_ID =
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export interface BugSnapshot {
  capturedAt: number;
  browser: string;
  playerName?: string;
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
  done?: boolean;
}
