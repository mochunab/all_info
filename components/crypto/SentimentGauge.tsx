'use client';

type SentimentGaugeProps = {
  score: number; // -1 ~ 1
  size?: 'sm' | 'md';
};

export default function SentimentGauge({ score, size = 'md' }: SentimentGaugeProps) {
  const percentage = ((score + 1) / 2) * 100;
  const color = score > 0.3
    ? 'var(--color-bullish, #22c55e)'
    : score < -0.3
      ? 'var(--color-bearish, #ef4444)'
      : 'var(--color-neutral, #eab308)';

  const barHeight = size === 'sm' ? 'h-1.5' : 'h-2';
  const fontSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${barHeight} bg-[var(--bg-tertiary,#374151)] rounded-full overflow-hidden`}>
        <div
          className={`${barHeight} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <span className={`${fontSize} font-mono font-medium`} style={{ color }}>
        {score > 0 ? '+' : ''}{score.toFixed(2)}
      </span>
    </div>
  );
}
