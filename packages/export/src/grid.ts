/** Pure week-grid layout shared by the on-screen grid, print sheet and PNG export. */
import type { DayNo } from "@ky-nay/domain";
import type { ScheduledSession } from "./schedule.js";

export type GridBlock = {
  session: ScheduledSession;
  day: DayNo;
  startPeriod: number;
  endPeriod: number;
  /** 0-based column inside the day when blocks overlap. */
  lane: number;
  /** Number of lanes in the overlapping cluster this block belongs to. */
  lanes: number;
  conflict: boolean;
};

export type GridLayout = {
  days: DayNo[];
  periods: number[];
  blocks: GridBlock[];
};

export type GridOptions = {
  /** Only sessions taught in this week; `undefined` shows every week. */
  week?: number;
  maxPeriod: number;
  conflictKeys?: ReadonlySet<string>;
};

const WEEKDAYS: DayNo[] = [2, 3, 4, 5, 6, 7];

export function buildGridLayout(sessions: readonly ScheduledSession[], options: GridOptions): GridLayout {
  const placed = sessions.filter((session): session is ScheduledSession & { day: DayNo; startPeriod: number; endPeriod: number } =>
    session.fixed
    && session.day !== undefined
    && session.startPeriod !== undefined
    && session.endPeriod !== undefined
    && (options.week === undefined || session.weeks.includes(options.week)));
  const days = placed.some((session) => session.day === 8) ? [...WEEKDAYS, 8 as DayNo] : [...WEEKDAYS];
  const blocks: GridBlock[] = [];
  for (const day of days) {
    const dayBlocks = placed
      .filter((session) => session.day === day)
      .sort((a, b) => a.startPeriod - b.startPeriod || a.endPeriod - b.endPeriod || a.key.localeCompare(b.key));
    // Interval partitioning: each block takes the lowest free lane; a cluster ends when no block is still running.
    let cluster: GridBlock[] = [];
    let laneEnds: number[] = [];
    let clusterEnd = -1;
    const closeCluster = () => {
      for (const block of cluster) block.lanes = laneEnds.length;
      cluster = [];
      laneEnds = [];
    };
    for (const session of dayBlocks) {
      if (session.startPeriod > clusterEnd) closeCluster();
      let lane = laneEnds.findIndex((end) => end < session.startPeriod);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = session.endPeriod;
      clusterEnd = Math.max(clusterEnd, session.endPeriod);
      const block: GridBlock = {
        session,
        day,
        startPeriod: session.startPeriod,
        endPeriod: session.endPeriod,
        lane,
        lanes: 1,
        conflict: options.conflictKeys?.has(session.key) ?? false,
      };
      cluster.push(block);
      blocks.push(block);
    }
    closeCluster();
  }
  return { days, periods: Array.from({ length: options.maxPeriod }, (_, index) => index + 1), blocks };
}
