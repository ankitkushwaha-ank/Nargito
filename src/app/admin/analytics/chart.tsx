"use client";
/** SVG sparkline/bar chart – zero dependencies, light+dark mode aware. */
type Point = { day: string; n: number };

function Bar({ points, color = "#3b82f6", label }: { points: Point[]; color?: string; label: string }) {
  if (!points.length) return <p className="text-sm text-muted">No data for this period.</p>;
  const max = Math.max(...points.map((p) => p.n), 1);
  const w = 600; const h = 120; const bw = Math.max(2, Math.floor(w / points.length) - 2);
  return (
    <figure className="overflow-x-auto" aria-label={label}>
      <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full" role="img" aria-label={label}>
        {points.map((p, i) => {
          const bh = Math.max(2, Math.round((p.n / max) * h));
          const x = Math.round((i / points.length) * w);
          return (
            <g key={p.day}>
              <rect x={x} y={h - bh} width={bw} height={bh} fill={color} opacity={0.8} rx={2}>
                <title>{p.day}: {p.n}</title>
              </rect>
              {(i === 0 || i === Math.floor(points.length / 2) || i === points.length - 1) && (
                <text x={x + bw / 2} y={h + 18} textAnchor="middle" fontSize={10} className="fill-slate-400">{p.day.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function Sparkline({ points, color = "#3b82f6", label }: { points: Point[]; color?: string; label: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points.map((p) => p.n), 1);
  const w = 600; const h = 60;
  const coords = points.map((p, i) => `${Math.round((i / (points.length - 1)) * w)},${Math.round(h - (p.n / max) * (h - 4) - 2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={label}>
      <polyline points={coords} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={p.day} cx={Math.round((i / (points.length - 1)) * w)} cy={Math.round(h - (p.n / max) * (h - 4) - 2)} r={3} fill={color}>
          <title>{p.day}: {p.n}</title>
        </circle>
      ))}
    </svg>
  );
}

export function GrowthChart({ growth }: { growth: Point[] }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-base font-bold">New members per day</h2>
      <Bar points={growth} color="#3b82f6" label="New members per day" />
    </div>
  );
}

export function PostsChart({ posts }: { posts: Point[] }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-base font-bold">Posts per day</h2>
      <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
        <Sparkline points={posts} color="#8b5cf6" label="Posts per day" />
      </div>
    </div>
  );
}
