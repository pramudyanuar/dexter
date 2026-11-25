import GameShell from '@/components/games/GameShell';

export default function SnakeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GameShell name='snake' fit>
      <div className='mx-auto w-full max-w-md space-y-4 pb-4'>{children}</div>
    </GameShell>
  );
}
