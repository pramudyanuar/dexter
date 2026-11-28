import GameShell from '@/features/games/components/GameShell';
import SumoHost from '@/features/sumo-arena/SumoHost';

export default function SumoPage() {
  return (
    <GameShell name='sumo' fluid>
      <SumoHost />
    </GameShell>
  );
}
