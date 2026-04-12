const badgeStyle = { fontSize: 12, fontWeight: 700, padding: '2px 7px', borderRadius: 10, flexShrink: 0 } as const;

export default function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#2e7d32' : score >= 40 ? '#e65100' : '#c62828';
  const bg    = score >= 70 ? '#e8f5e9' : score >= 40 ? '#fff3e0' : '#ffebee';
  return <span style={{ ...badgeStyle, color, background: bg }}>{score}%</span>;
}
