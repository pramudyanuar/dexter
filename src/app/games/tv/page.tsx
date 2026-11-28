import GameShell from '@/features/games/components/GameShell';
import TvHost from '@/features/tv-controller/TvHost';

export default function TvGamePage() {
  return (
    <GameShell name='tv' fluid>
      <TvHost />
    </GameShell>
  );
}
