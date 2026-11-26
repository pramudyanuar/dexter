import { LeaderboardEntry, scoreUnit } from '@/lib/leaderboard/types';

export default function LeaderboardTable({
  game,
  entries,
  showMeta = true,
  showVerification = false,
}: {
  game: string;
  entries: LeaderboardEntry[];
  showMeta?: boolean;
  showVerification?: boolean;
}) {
  const unit = scoreUnit(game);
  return (
    <table className='w-full text-left text-sm'>
      <thead className='border-b border-line text-xs text-[var(--mute)]'>
        <tr>
          <th className='w-16 px-4 py-2.5 font-medium'>Rank</th>
          <th className='px-4 py-2.5 font-medium'>Pemain</th>
          {showMeta && <th className='px-4 py-2.5 font-medium'>Catatan</th>}
          <th className='px-4 py-2.5 text-right font-medium capitalize'>
            {unit}
          </th>
        </tr>
      </thead>
      <tbody className='divide-y divide-line'>
        {entries.map((entry, idx) => (
          <tr key={entry.id} className='hover:bg-card/50'>
            <td className='px-4 py-2.5 font-mono text-xs'>
              {idx === 0 ? (
                <span className='font-semibold text-[#e4b34a]'>#1</span>
              ) : idx === 1 ? (
                <span className='font-semibold text-[#c0c4cc]'>#2</span>
              ) : idx === 2 ? (
                <span className='font-semibold text-[#cd8a5b]'>#3</span>
              ) : (
                <span className='text-[var(--mute)]'>#{idx + 1}</span>
              )}
            </td>
            <td className='px-4 py-2.5 font-medium text-ink'>
              {entry.name}
              {game === '2048' && entry.usedUndo && (
                <span className='ml-2 inline-block rounded-full border border-line-strong px-2 py-0.5 text-xs font-normal text-mute'>
                  Undo
                </span>
              )}
              {showVerification && !entry.verified && (
                <span className='block text-xs font-normal text-mute'>
                  Skor lama · belum diverifikasi
                </span>
              )}
            </td>
            {showMeta && (
              <td className='px-4 py-2.5 text-xs text-[var(--mute)]'>
                {entry.meta ?? '-'}
              </td>
            )}
            <td className='px-4 py-2.5 text-right font-mono font-semibold text-accent'>
              {entry.score.toLocaleString('id-ID')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
