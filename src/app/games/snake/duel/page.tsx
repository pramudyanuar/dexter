import { CODE_PATTERN, normalizeCode } from '@/lib/rooms/code-format';

import SnakeDuel from '@/components/games/snake/SnakeDuel';
import SnakeShell from '@/components/games/snake/SnakeShell';

export default async function SnakeDuelPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string | string[] }>;
}) {
  const { room } = await searchParams;
  const code = normalizeCode(typeof room === 'string' ? room : '');
  return (
    <SnakeShell mode='duel'>
      <SnakeDuel invite={CODE_PATTERN.test(code) ? code : ''} />
    </SnakeShell>
  );
}
