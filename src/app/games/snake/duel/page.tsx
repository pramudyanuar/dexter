import { CODE_PATTERN, normalizeCode } from '@/lib/rooms/code-format';

import GameShell from '@/components/games/GameShell';
import SnakeDuel from '@/components/games/snake/SnakeDuel';

export default async function SnakeDuelPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string | string[] }>;
}) {
  const { room } = await searchParams;
  const code = normalizeCode(typeof room === 'string' ? room : '');
  return (
    <GameShell name='snake' fit>
      <SnakeDuel invite={CODE_PATTERN.test(code) ? code : ''} />
    </GameShell>
  );
}
