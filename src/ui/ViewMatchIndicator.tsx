import { useTeeSimStore } from '../store';

const toneByStatus = {
  match: 'green',
  near: 'amber',
  exploring: 'gray',
} as const;

const statusLabel = {
  match: 'Match',
  near: 'Near',
  exploring: 'Exploring',
} as const;

export function ViewMatchIndicator() {
  const bestMatch = useTeeSimStore((state) => state.viewMatch.bestMatch);
  const status = bestMatch?.status ?? 'exploring';
  const tone = toneByStatus[status];
  const quality = Math.round((bestMatch?.score ?? 0) * 100);

  return (
    <div
      className="view-match-indicator"
      data-match-level={tone}
      data-match-status={status}
      data-testid="view-match-indicator"
    >
      <span className="match-status">{statusLabel[status]}</span>
      <strong>{bestMatch?.preset.label ?? 'No preset nearby'}</strong>
      <span className="match-quality">{quality}% quality</span>
    </div>
  );
}
