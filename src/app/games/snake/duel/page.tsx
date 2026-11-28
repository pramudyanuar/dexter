import SnakeDuel from '@/features/games/components/snake/SnakeDuel';
import SnakeShell from '@/features/games/components/snake/SnakeShell';
import { CODE_PATTERN, normalizeCode } from '@/features/rooms/code-format';

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
