import GameShell from '@/features/games/components/GameShell';
import PixelSoccerHost from '@/features/pixel-soccer/PixelSoccerHost';

export default function BolaPixelPage() {
  return (
    <GameShell name='bola' fluid>
      <PixelSoccerHost />
    </GameShell>
  );
}
