/**
 * Werewolf's roles and settings. The roles live in one registry, so adding a
 * role later means adding an entry here and its ability in the engine.
 */

export type Team = 'village' | 'wolf' | 'neutral';

export type RoleId =
  | 'villager'
  | 'seer'
  | 'doctor'
  | 'bodyguard'
  | 'witch'
  | 'hunter'
  | 'werewolf'
  | 'alpha'
  | 'jester'
  | 'mayor'
  | 'serialkiller'
  | 'mason';

export interface RoleInfo {
  id: RoleId;
  name: string;
  team: Team;
  /** What the role does, in a sentence or two, shown at the role reveal */
  blurb: string;
  /** Acts at night */
  night: boolean;
  /** Counts as part of the Werewolf team for win conditions */
  wolfTeam?: boolean;
  /** Part of the optional "variations" (switched on as a group) */
  variation?: boolean;
  /** Implemented, or only reserved for later */
  ready: boolean;
}

export const ROLES: Record<RoleId, RoleInfo> = {
  villager: {
    id: 'villager',
    name: 'Villager',
    team: 'village',
    night: false,
    ready: true,
    blurb:
      'No special power. Talk, watch, and vote out the werewolves before they take over the village.',
  },
  seer: {
    id: 'seer',
    name: 'Seer',
    team: 'village',
    night: true,
    ready: true,
    blurb:
      'Each night you look at one player and learn whether they are on the werewolf team.',
  },
  doctor: {
    id: 'doctor',
    name: 'Doctor',
    team: 'village',
    night: true,
    ready: true,
    blurb:
      'Each night you protect one player. If the werewolves pick them, they survive.',
  },
  bodyguard: {
    id: 'bodyguard',
    name: 'Bodyguard',
    team: 'village',
    night: true,
    ready: true,
    blurb:
      'Each night you guard one player. If the werewolves attack them, you die in their place.',
  },
  witch: {
    id: 'witch',
    name: 'Witch',
    team: 'village',
    night: true,
    ready: true,
    blurb:
      'You have one healing potion and one poison, each usable once. You see who the werewolves attacked.',
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    team: 'village',
    night: false,
    ready: true,
    blurb: 'If you are eliminated, you take one other player down with you.',
  },
  werewolf: {
    id: 'werewolf',
    name: 'Werewolf',
    team: 'wolf',
    wolfTeam: true,
    night: true,
    ready: true,
    blurb:
      'You know the other werewolves. Each night the pack picks a victim. By day, blend in.',
  },
  alpha: {
    id: 'alpha',
    name: 'Alpha Werewolf',
    team: 'wolf',
    wolfTeam: true,
    night: true,
    variation: true,
    ready: true,
    blurb:
      'The pack leader. The Seer sees you as innocent, and once per game you may attack two players in one night.',
  },
  jester: {
    id: 'jester',
    name: 'Jester',
    team: 'neutral',
    night: false,
    variation: true,
    ready: true,
    blurb:
      'You win alone if the village votes you out. Act suspicious, but not too suspicious.',
  },
  mayor: {
    id: 'mayor',
    name: 'Mayor',
    team: 'village',
    night: false,
    variation: true,
    ready: true,
    blurb: 'Your vote counts double in the daily vote.',
  },
  serialkiller: {
    id: 'serialkiller',
    name: 'Serial Killer',
    team: 'neutral',
    night: true,
    variation: true,
    ready: true,
    blurb:
      'You work alone and kill one player every night. Protections do not stop you. Be the last one standing.',
  },
  mason: {
    id: 'mason',
    name: 'Mason',
    team: 'village',
    night: false,
    variation: true,
    ready: true,
    blurb:
      'You know the other Mason, so you each know one person you can trust.',
  },
};

export const ROLE_IDS = Object.keys(ROLES) as RoleId[];

export type Preset = 'classic' | 'beginner' | 'advanced' | 'custom';
export const PRESETS: readonly Preset[] = [
  'classic',
  'beginner',
  'advanced',
  'custom',
];

export type TieRule = 'none' | 'random' | 'revote';

/** The special roles the host can switch on. The count is one except for Masons (two). */
export type Toggle = Exclude<RoleId, 'villager' | 'werewolf'>;
export const TOGGLES: readonly Toggle[] = [
  'seer',
  'doctor',
  'bodyguard',
  'witch',
  'hunter',
  'alpha',
  'mayor',
  'jester',
  'serialkiller',
  'mason',
];

export interface WerewolfConfig {
  preset: Preset;
  maxPlayers: number;
  /** Werewolves in the game; 0 chooses by the number of players */
  wolves: number;
  roles: Record<Toggle, boolean>;
  /** Master switch for the optional roles (alpha, jester, mayor, serial killer, mason) */
  variations: boolean;
  doctorSelf: boolean;
  bodyguardRepeat: boolean;
  /** The bodyguard dies in place of the one they guard */
  bodyguardDies: boolean;
  /** The Seer sees the Alpha as a villager */
  alphaHidden: boolean;
  /** The Hunter shoots even when poisoned */
  hunterOnPoison: boolean;
  discussionSeconds: number;
  votingSeconds: number;
  nightSeconds: number;
  anonymousVoting: boolean;
  revealRoles: boolean;
  voteChange: boolean;
  tieRule: TieRule;
  deadChat: boolean;
}

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 20;

const none: Record<Toggle, boolean> = {
  seer: false,
  doctor: false,
  bodyguard: false,
  witch: false,
  hunter: false,
  alpha: false,
  mayor: false,
  jester: false,
  serialkiller: false,
  mason: false,
};

export const DEFAULT_WEREWOLF: WerewolfConfig = {
  preset: 'classic',
  maxPlayers: 12,
  wolves: 0,
  roles: { ...none, seer: true, doctor: true },
  variations: false,
  doctorSelf: true,
  bodyguardRepeat: false,
  bodyguardDies: true,
  alphaHidden: true,
  hunterOnPoison: false,
  discussionSeconds: 90,
  votingSeconds: 45,
  nightSeconds: 45,
  anonymousVoting: false,
  revealRoles: true,
  voteChange: true,
  tieRule: 'none',
  deadChat: true,
};

/** What each preset switches on. */
export function presetConfig(preset: Preset): Partial<WerewolfConfig> {
  switch (preset) {
    case 'beginner':
      return {
        roles: { ...none, seer: true },
        variations: false,
        discussionSeconds: 150,
        votingSeconds: 60,
        nightSeconds: 60,
        revealRoles: true,
        voteChange: true,
        tieRule: 'none',
      };
    case 'advanced':
      return {
        roles: {
          ...none,
          seer: true,
          doctor: true,
          witch: true,
          hunter: true,
          bodyguard: true,
          alpha: true,
          jester: true,
          mayor: true,
          serialkiller: false,
          mason: false,
        },
        variations: true,
        discussionSeconds: 90,
        votingSeconds: 45,
        nightSeconds: 45,
        tieRule: 'revote',
      };
    default:
      return {};
  }
}

const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(max, Math.max(min, Math.round(v)))
    : fallback;
const bool = (v: unknown, fallback: boolean) =>
  typeof v === 'boolean' ? v : fallback;

export function sanitizeWerewolf(raw: unknown): WerewolfConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const preset = PRESETS.includes(r.preset as Preset)
    ? (r.preset as Preset)
    : 'classic';
  const base: WerewolfConfig = {
    ...DEFAULT_WEREWOLF,
    ...presetConfig(preset),
    preset,
  };
  const given = (
    r.roles && typeof r.roles === 'object' ? r.roles : {}
  ) as Record<string, unknown>;
  const roles = { ...base.roles };
  for (const t of TOGGLES) roles[t] = bool(given[t], base.roles[t]);

  return {
    preset,
    maxPlayers: int(r.maxPlayers, MIN_PLAYERS, MAX_PLAYERS, base.maxPlayers),
    wolves: int(r.wolves, 0, 6, base.wolves),
    roles,
    variations: bool(r.variations, base.variations),
    doctorSelf: bool(r.doctorSelf, base.doctorSelf),
    bodyguardRepeat: bool(r.bodyguardRepeat, base.bodyguardRepeat),
    bodyguardDies: bool(r.bodyguardDies, base.bodyguardDies),
    alphaHidden: bool(r.alphaHidden, base.alphaHidden),
    hunterOnPoison: bool(r.hunterOnPoison, base.hunterOnPoison),
    discussionSeconds: int(
      r.discussionSeconds,
      15,
      600,
      base.discussionSeconds,
    ),
    votingSeconds: int(r.votingSeconds, 10, 300, base.votingSeconds),
    nightSeconds: int(r.nightSeconds, 10, 300, base.nightSeconds),
    anonymousVoting: bool(r.anonymousVoting, base.anonymousVoting),
    revealRoles: bool(r.revealRoles, base.revealRoles),
    voteChange: bool(r.voteChange, base.voteChange),
    tieRule:
      r.tieRule === 'random' || r.tieRule === 'revote' || r.tieRule === 'none'
        ? r.tieRule
        : base.tieRule,
    deadChat: bool(r.deadChat, base.deadChat),
  };
}

/** How many werewolves a game of `n` players has when the host leaves it to the game. */
export const autoWolves = (n: number) => Math.max(1, Math.floor(n / 4));

/** A role is in play if it is switched on, and (for the optional ones) so are the variations. */
export function enabled(config: WerewolfConfig, role: Toggle): boolean {
  if (!config.roles[role]) return false;
  return !ROLES[role].variation || config.variations;
}

/**
 * The roles for a game of `n` players, in no particular order: the werewolves
 * first (the first one the Alpha, if there is one), then each special role in
 * turn while there is room, and villagers for the rest. Werewolves never make
 * up half the table.
 */
export function roleList(n: number, config: WerewolfConfig): RoleId[] {
  const maxWolves = Math.max(1, Math.ceil(n / 2) - 1);
  const wolves = Math.min(
    maxWolves,
    config.wolves > 0 ? config.wolves : autoWolves(n),
  );
  const out: RoleId[] = Array.from({ length: wolves }, () => 'werewolf');
  if (enabled(config, 'alpha')) out[0] = 'alpha';

  const order: Toggle[] = [
    'seer',
    'doctor',
    'witch',
    'hunter',
    'bodyguard',
    'mayor',
    'jester',
    'serialkiller',
  ];
  for (const role of order) {
    if (out.length >= n) break;
    if (!enabled(config, role)) continue;
    // keep at least one plain villager at a small table
    if (out.length >= n - 1 && n <= 6) break;
    out.push(role);
  }
  if (enabled(config, 'mason') && out.length + 2 <= n - 1)
    out.push('mason', 'mason');
  while (out.length < n) out.push('villager');
  return out;
}

export const PRESET_INFO: Record<Preset, { title: string; blurb: string }> = {
  classic: {
    title: 'Classic',
    blurb:
      'Villagers, a Seer, a Doctor and the Werewolves. The traditional game.',
  },
  beginner: {
    title: 'Beginner',
    blurb: 'Just a Seer to start, longer discussions and simpler rules.',
  },
  advanced: {
    title: 'Advanced',
    blurb:
      'Witch, Hunter, Bodyguard, an Alpha Werewolf, a Jester and a Mayor, with a revote on ties.',
  },
  custom: {
    title: 'Custom',
    blurb: 'You choose the roles, the timers and the rules.',
  },
};
