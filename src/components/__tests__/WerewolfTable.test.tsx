import { fireEvent, render, screen, within } from '@testing-library/react';

import {
  RoleId,
  start,
  werewolfGame as g,
  WerewolfState,
  WerewolfView,
} from '@/lib/games/werewolf';
import type { RoomView } from '@/lib/rooms/types';

import WerewolfTable from '@/components/games/werewolf/WerewolfTable';

// the game's moves copy the state, and jsdom has no structuredClone
global.structuredClone = ((v: unknown) =>
  JSON.parse(JSON.stringify(v))) as never;

function setup(
  roles: RoleId[],
  you: number,
  tweak: (s: WerewolfState) => void = () => {},
  cfg: Record<string, unknown> = {},
) {
  const s = start(roles.length, () => 0.2, cfg);
  s.roles = roles;
  tweak(s);
  const view = g.view(s, you) as WerewolfView;
  const room = {
    code: 'ABCDE',
    game: 'werewolf',
    status: 'playing',
    seat: you,
    joined: roles.map(() => true),
    names: roles.map((_, i) => `P${i}`),
    capacity: 12,
    minPlayers: 5,
    version: 1,
    state: view,
    options: s.config,
    out: roles.map(() => false),
    outWhy: roles.map(() => null),
    strikes: roles.map(() => 0),
    maxStrikes: 3,
    host: 0,
    hostNotice: 0,
    leaving: [],
    waiting: null,
  } as unknown as RoomView;
  const r = {
    session: { code: 'ABCDE', token: 't', you },
    room,
    receivedAt: Date.now(),
    busy: false,
    error: '',
    move: jest.fn(),
    rematch: jest.fn(),
    leave: jest.fn(),
  };
  render(<WerewolfTable r={r as never} view={view} />);
  return r;
}

const ROLES5: RoleId[] = ['werewolf', 'seer', 'doctor', 'villager', 'villager'];
const night = (s: WerewolfState) => {
  s.phase = 'night';
  s.day = 1;
  s.deadline = Date.now() + 45_000;
};

describe('WerewolfTable', () => {
  it("shows you your own role at the start, and nobody else's", () => {
    setup(ROLES5, 3, (s) => {
      s.phase = 'roles';
    });
    expect(document.querySelector('[data-role]')).toHaveAttribute(
      'data-role',
      'villager',
    );
    expect(
      screen.getByRole('heading', { name: 'Villager' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Werewolf')).toBeNull();
    expect(screen.queryByText('Seer')).toBeNull();
  });

  it('tells a werewolf who the rest of the pack is', () => {
    setup(
      ['werewolf', 'werewolf', 'seer', 'villager', 'villager', 'villager'],
      0,
      (s) => {
        s.phase = 'roles';
      },
    );
    expect(screen.getByTestId('allies')).toHaveTextContent('P1');
  });

  it('is ready when you say so', () => {
    const r = setup(ROLES5, 3, (s) => {
      s.phase = 'roles';
    });
    fireEvent.click(screen.getByRole('button', { name: "I'm ready" }));
    expect(r.move).toHaveBeenCalledWith({ type: 'ready' });
  });

  it('lets a werewolf pick a victim at night, but not a fellow werewolf', () => {
    const r = setup(
      ['werewolf', 'werewolf', 'seer', 'doctor', 'villager', 'villager'],
      0,
      night,
    );
    const targets = within(screen.getByTestId('targets'));
    expect(targets.getByRole('button', { name: 'P1' })).toBeDisabled();
    expect(targets.getByRole('button', { name: 'You' })).toBeDisabled();
    fireEvent.click(targets.getByRole('button', { name: 'P4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Strike' }));
    expect(r.move).toHaveBeenCalledWith({
      type: 'night',
      target: 4,
      second: null,
    });
  });

  it("shows the pack each other's picks, and nobody else", () => {
    const pack: RoleId[] = [
      'werewolf',
      'werewolf',
      'seer',
      'doctor',
      'villager',
      'villager',
    ];
    setup(pack, 1, (s) => {
      night(s);
      s.night.wolf = { 0: 4 };
    });
    expect(screen.getByLabelText('Pack votes')).toHaveTextContent('P0 → P4');
  });

  it('a villager only sees the night fall', () => {
    setup(ROLES5, 3, night);
    expect(screen.getByText(/Night falls/)).toBeInTheDocument();
    expect(screen.queryByTestId('targets')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Strike' })).toBeNull();
  });

  it('the Seer looks at someone, and keeps what they learn', () => {
    const r = setup(ROLES5, 1, night);
    fireEvent.click(
      within(screen.getByTestId('targets')).getByRole('button', { name: 'P0' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Look' }));
    expect(r.move).toHaveBeenCalledWith({ type: 'night', target: 0 });
  });

  it("the Seer's notes show by day, and only to the Seer", () => {
    const day = (s: WerewolfState) => {
      s.phase = 'discussion';
      s.day = 1;
      s.seen = [{ seat: 1, day: 1, target: 0, wolf: true }];
    };
    setup(ROLES5, 1, day);
    expect(screen.getByTestId('seer-notes')).toHaveTextContent(
      'P0 is a werewolf',
    );
  });

  it('the Doctor can protect or skip', () => {
    const r = setup(ROLES5, 2, night);
    fireEvent.click(screen.getByRole('button', { name: 'Skip tonight' }));
    expect(r.move).toHaveBeenCalledWith({ type: 'night', target: null });
  });

  it('the Witch waits for the pack, then is told who they chose', () => {
    const roles: RoleId[] = [
      'werewolf',
      'witch',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const { unmount } = render(<div />);
    unmount();
    const r = setup(roles, 1, (s) => {
      night(s);
      s.stage = 'witch';
      s.night.victim = 3;
    });
    expect(screen.getByText('The werewolves attacked P3.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use healing potion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(r.move).toHaveBeenCalledWith({
      type: 'night',
      heal: true,
      poison: null,
    });
  });

  it('announces who died in the morning, or that nobody did', () => {
    setup(ROLES5, 4, (s) => {
      s.phase = 'morning';
      s.day = 1;
      s.alive[3] = false;
      s.deaths = [{ seat: 3, cause: 'wolves', day: 1 }];
      s.morning = [{ seat: 3, cause: 'wolves', day: 1 }];
    });
    expect(screen.getByText('Someone is dead.')).toBeInTheDocument();
    expect(screen.getByText(/was the Villager/)).toBeInTheDocument();
  });

  it('keeps the role secret when the game is set that way', () => {
    setup(
      ROLES5,
      4,
      (s) => {
        s.phase = 'morning';
        s.day = 1;
        s.alive[3] = false;
        s.deaths = [{ seat: 3, cause: 'wolves', day: 1 }];
        s.morning = [{ seat: 3, cause: 'wolves', day: 1 }];
      },
      { revealRoles: false },
    );
    expect(screen.getByText('Their role stays secret.')).toBeInTheDocument();
    expect(screen.queryByText(/was the Villager/)).toBeNull();
  });

  it('says the village survived when nobody died', () => {
    setup(ROLES5, 4, (s) => {
      s.phase = 'morning';
      s.day = 1;
    });
    expect(
      screen.getByText('The village survived the night.'),
    ).toBeInTheDocument();
  });

  it('lets the living vote, and shows who voted for whom when public', () => {
    const r = setup(ROLES5, 3, (s) => {
      s.phase = 'voting';
      s.day = 1;
      s.votes = { 0: 4 };
    });
    expect(screen.getByTestId('progress')).toHaveTextContent('1/5 voted');
    expect(screen.getByLabelText('Votes')).toHaveTextContent('P0 → P4');
    fireEvent.click(
      within(screen.getByTestId('roster')).getByRole('button', { name: 'P0' }),
    );
    expect(r.move).toHaveBeenCalledWith({ type: 'vote', target: 0 });
    // not for yourself
    expect(
      within(screen.getByTestId('roster')).getByRole('button', { name: 'You' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Abstain' }));
    expect(r.move).toHaveBeenCalledWith({ type: 'vote', target: null });
  });

  it('hides the votes when voting is anonymous', () => {
    setup(
      ROLES5,
      3,
      (s) => {
        s.phase = 'voting';
        s.day = 1;
        s.votes = { 0: 4 };
      },
      { anonymousVoting: true },
    );
    expect(screen.queryByLabelText('Votes')).toBeNull();
    expect(screen.getByTestId('progress')).toHaveTextContent('1/5 voted');
    expect(screen.getByText(/votes are secret/)).toBeInTheDocument();
  });

  it('the dead cannot vote, and are told so', () => {
    setup(ROLES5, 3, (s) => {
      s.phase = 'voting';
      s.day = 1;
      s.alive[3] = false;
    });
    expect(screen.getByRole('status')).toHaveTextContent(/eliminated/);
    expect(screen.queryByRole('button', { name: 'Abstain' })).toBeNull();
  });

  it('the Hunter takes a last shot', () => {
    const r = setup(
      ['werewolf', 'hunter', 'villager', 'villager', 'villager', 'villager'],
      1,
      (s) => {
        s.phase = 'hunter';
        s.day = 1;
        s.alive[1] = false;
        s.hunter = { seat: 1, next: 'discussion' };
      },
    );
    fireEvent.click(
      within(screen.getByTestId('roster')).getByRole('button', { name: 'P0' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fire' }));
    expect(r.move).toHaveBeenCalledWith({ type: 'hunter', target: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Hold fire' }));
    expect(r.move).toHaveBeenCalledWith({ type: 'hunter', target: null });
  });

  it('everyone else just watches the Hunter', () => {
    setup(
      ['werewolf', 'hunter', 'villager', 'villager', 'villager', 'villager'],
      3,
      (s) => {
        s.phase = 'hunter';
        s.day = 1;
        s.alive[1] = false;
        s.hunter = { seat: 1, next: 'discussion' };
      },
    );
    expect(screen.getByText(/takes a last shot/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fire' })).toBeNull();
  });

  it('shows the winner and every role at the end, with the history', () => {
    const r = setup(ROLES5, 3, (s) => {
      s.phase = 'over';
      s.day = 2;
      s.alive = [false, true, true, true, true];
      s.deaths = [{ seat: 0, cause: 'vote', day: 2 }];
      s.winner = { team: 'village', seats: [1, 2, 3, 4] };
      s.nightLog = [
        {
          day: 1,
          wolfVotes: { 0: 4 },
          victim: 4,
          second: null,
          seer: { seat: 1, target: 0, wolf: true },
          doctor: 4,
          guard: null,
          sk: null,
          heal: false,
          poison: null,
          saved: [4],
          deaths: [],
        },
      ];
    });
    expect(screen.getByText('The Village wins!')).toBeInTheDocument();
    expect(screen.getByText('You won')).toBeInTheDocument();
    const list = within(screen.getByLabelText('Final roles'));
    expect(list.getAllByRole('listitem')).toHaveLength(5);
    expect(list.getAllByRole('listitem')[0]).toHaveTextContent(
      /Werewolf · wolf/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show the history' }));
    expect(screen.getByTestId('history')).toHaveTextContent(
      'The Seer looked at P0: werewolf',
    );
    expect(screen.getByTestId('history')).toHaveTextContent('Nobody died.');
    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }));
    expect(r.rematch).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Return to lobby' }));
    expect(r.leave).toHaveBeenCalled();
  });
});
