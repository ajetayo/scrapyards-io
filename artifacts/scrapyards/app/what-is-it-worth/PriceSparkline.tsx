// Server-renderable inline SVG sparkline. No client JS needed.
import type { PricePoint } from "@/lib/item-history";

type Props = {
  data: PricePoint[];
  width?: number;
  height?: number;
  label: string;
};

export function PriceSparkline({ data, width = 720, height = 220, label }: Props) {
  if (data.length < 2) {
    return (
      <div
        style={{
          padding: "1.5rem",
          color: "var(--color-text-muted)",
          fontSize: "0.9rem",
          textAlign: "center",
          border: "1px dashed var(--color-border)",
          borderRadius: "8px",
        }}
      >
        Not enough price history yet to chart {label}.
      </div>
    );
  }

  const padL = 48;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || max || 1;
  const yMin = Math.max(0, min - range * 0.1);
  const yMax = max + range * 0.1;

  const x = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const y = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.price).toFixed(1)}`).join(" ");
  const area = `${path} L ${x(data.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / ticks);

  const firstDate = data[0].date;
  const lastDate = data[data.length - 1].date;

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        role="img"
        aria-label={`${label} — ${data.length} day price history`}
        style={{ display: "block", maxWidth: "100%" }}
      >
        <title>{label} — last {data.length} days</title>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={padL + innerW}
              y1={y(t)}
              y2={y(t)}
              stroke="#e5e5e5"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(t) + 4}
              fontSize={11}
              fill="#888"
              textAnchor="end"
            >
              ${t.toFixed(2)}
            </text>
          </g>
        ))}
        <path d={area} fill="var(--color-accent)" fillOpacity={0.12} />
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].price)} r={4} fill="var(--color-accent)" />
        <text x={padL} y={height - 8} fontSize={11} fill="#666" textAnchor="start">{firstDate}</text>
        <text x={padL + innerW} y={height - 8} fontSize={11} fill="#666" textAnchor="end">{lastDate}</text>
      </svg>
    </figure>
  );
}
