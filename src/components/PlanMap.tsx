import { useMemo, useState, useEffect } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { worldGeo } from '../data/worldGeo';
import type { PlanningAirport } from '../data/planningAirports';
import type { TransportMode } from '../lib/tripPlanner';

const WIDTH = 360;
const HEIGHT = 320;
const PAD = 34;
const CARD_WIDTH = 168;
const CARD_HEIGHT = 74;

interface PlanCity {
  city: string;
  lat: number;
  lng: number;
  nights?: number;
  why?: string;
}
interface MapLegInfo {
  mode: TransportMode;
  distanceKm: number;
  hours: number;
}

// Small SVG-native icon paths, scaled to sit inside an 12x12 badge slot.
// Kept as plain paths (not the app's icon components) since these render
// inside an SVG document, not the HTML tree.
const MODE_ICON_PATH: Record<TransportMode, string> = {
  flight: 'M1 6h3l2-3.5 1 .5-1 3h2.5l1-1.5h1l-.75 2L11 8h-1l-1-1.5H6.5l1 3-1 .5-2-3.5H1z',
  rail: 'M2.5 1.5h7v7a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 2.5 8.5zM2.5 6.5h7M4 10l-1 2M8 10l1 2',
  road: 'M2 9V6.5l1-2.5h6l1 2.5V9M2 9h8M2.7 9v1M9.3 9v1',
};

function formatHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins === 0 ? `${hours}h` : `${hours}h${mins}m`;
}

function LegBadge({ x, y, info }: { x: number; y: number; info: MapLegInfo }) {
  const label = `${Math.round(info.distanceKm)}km · ${formatHours(info.hours)}`;
  const badgeWidth = 15 + label.length * 3.6;
  return (
    <g transform={`translate(${x - badgeWidth / 2}, ${y - 8})`}>
      <rect width={badgeWidth} height={16} rx={8} fill="#fff" stroke="#5B3FA6" strokeWidth={1} />
      <g transform="translate(4, 3)" fill="none" stroke="#5B3FA6" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round">
        <path d={MODE_ICON_PATH[info.mode]} />
      </g>
      <text x={16} y={11} fontSize={6.2} fontWeight={700} fill="#17171C">
        {label}
      </text>
    </g>
  );
}

// Info card shown when a city dot is tapped -- real HTML/CSS via
// foreignObject for the content, so it stays in the same SVG coordinate
// space as everything else rather than needing fragile pixel-to-viewBox
// mapping for a separate HTML overlay. The close control itself is pure
// SVG, rendered as a separate sibling rather than an HTML button inside
// the foreignObject -- confirmed via testing that click events on HTML
// controls nested in foreignObject don't reliably propagate through
// React's synthetic event system in this setup.
function cardPosition(x: number, y: number) {
  const cardX = Math.max(4, Math.min(WIDTH - CARD_WIDTH - 4, x - CARD_WIDTH / 2));
  const flipUp = y + 14 + CARD_HEIGHT > HEIGHT - 4;
  const cardY = flipUp ? y - 14 - CARD_HEIGHT : y + 14;
  return { cardX, cardY };
}

function CityInfoCard({ x, y, rank, city }: { x: number; y: number; rank: number; city: PlanCity }) {
  const { cardX, cardY } = cardPosition(x, y);

  return (
    <foreignObject x={cardX} y={cardY} width={CARD_WIDTH} height={CARD_HEIGHT} style={{ overflow: 'visible', pointerEvents: 'none' }}>
      <div
        {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}
        style={{
          background: '#fff', borderRadius: 10, border: '1.5px solid #5B3FA6', padding: '8px 26px 8px 10px',
          boxShadow: '0 6px 16px rgba(23,23,28,.18)', fontFamily: 'inherit', boxSizing: 'border-box', height: '100%',
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#17171C', lineHeight: 1.2 }}>
          {rank}. {city.city}
        </div>
        {city.nights != null && (
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#5B3FA6', marginTop: 2 }}>{city.nights} nights</div>
        )}
        {city.why && (
          <div style={{ fontSize: 10, color: '#5C5C6E', marginTop: 3, lineHeight: 1.35 }}>{city.why}</div>
        )}
      </div>
    </foreignObject>
  );
}

export function PlanMap({
  home, cities, domesticLegs, internationalLeg,
}: {
  home: PlanningAirport | null;
  cities: PlanCity[];
  domesticLegs: MapLegInfo[]; // one per consecutive city pair, same order as cities
  internationalLeg: MapLegInfo | null; // home -> first city
}) {
  const [selected, setSelected] = useState<number | null>(null);

  const { countryPaths, homePoint, cityPoints, internationalPath, domesticSegments } = useMemo(() => {
    const points: [number, number][] = cities.map((c) => [c.lng, c.lat]);
    if (home) points.push([home.lng, home.lat]);
    if (points.length === 0) {
      return { countryPaths: [], homePoint: null, cityPoints: [], internationalPath: '', domesticSegments: [] };
    }

    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    const degenerate = Math.max(...lngs) - Math.min(...lngs) < 0.05 && Math.max(...lats) - Math.min(...lats) < 0.05;

    const projection = geoNaturalEarth1();
    if (degenerate) {
      projection.center([lngs[0], lats[0]]).scale(2400).translate([WIDTH / 2, HEIGHT / 2]);
    } else {
      projection.fitExtent([[PAD, PAD], [WIDTH - PAD, HEIGHT - PAD]], { type: 'MultiPoint', coordinates: points });
    }
    const pathGen = geoPath(projection);
    const project = (lat: number, lng: number) => projection([lng, lat]) as [number, number] | null;

    const countryPaths: { name: string; d: string }[] = worldGeo.features
      .map((f: any) => ({ name: f.properties.name as string, d: pathGen(f) || '' }))
      .filter((c: { d: string }) => c.d);

    const projectedCities = cities
      .map((c) => {
        const p = project(c.lat, c.lng);
        return p ? { city: c.city, x: p[0], y: p[1] } : null;
      })
      .filter((c): c is { city: string; x: number; y: number } => c !== null);

    const homeProjected = home ? project(home.lat, home.lng) : null;

    let internationalPath = '';
    if (homeProjected && projectedCities.length > 0) {
      const [x1, y1] = homeProjected;
      const { x: x2, y: y2 } = projectedCities[0];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - Math.min(40, Math.hypot(x2 - x1, y2 - y1) * 0.2);
      internationalPath = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
    }

    const domesticSegments = projectedCities.slice(0, -1).map((c, i) => {
      const next = projectedCities[i + 1];
      return { d: `M${c.x},${c.y} L${next.x},${next.y}`, mid: { x: (c.x + next.x) / 2, y: (c.y + next.y) / 2 } };
    });

    return { countryPaths, homePoint: homeProjected ? { x: homeProjected[0], y: homeProjected[1] } : null, cityPoints: projectedCities, internationalPath, domesticSegments };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, cities]);

  const citiesKey = cities.map((c) => c.city).join('|');
  useEffect(() => {
    setSelected(null); // city list genuinely changed (reorder/refresh/focus toggle) -- any open card is now stale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citiesKey]);

  if (cityPoints.length === 0) return null;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block', background: '#DCE7F5', borderRadius: 16 }}>
      <style>{`
        @keyframes planmap-pulse { 0% { r: 4.2; opacity: .55; } 100% { r: 11; opacity: 0; } }
        .planmap-pulse { animation: planmap-pulse 1.6s ease-out infinite; transform-origin: center; transform-box: fill-box; }
      `}</style>
      {countryPaths.map((c) => (
        <path key={c.name} d={c.d} fill="#B9CEEC" stroke="#DCE7F5" strokeWidth={0.5} />
      ))}
      {internationalPath && (
        <path d={internationalPath} fill="none" stroke="#5B3FA6" strokeWidth={1.2} strokeDasharray="3 2.2" opacity={0.8} />
      )}
      {domesticSegments.map((seg, i) => (
        <path key={i} d={seg.d} fill="none" stroke="#5B3FA6" strokeWidth={1.4} strokeDasharray="3 2.2" opacity={0.85} />
      ))}
      {homePoint && (
        <circle cx={homePoint.x} cy={homePoint.y} r={3.4} fill="#fff" stroke="#5B3FA6" strokeWidth={1.6} />
      )}
      {cityPoints.map((c, i) => (
        <g key={c.city} onClick={() => setSelected(selected === i ? null : i)} style={{ cursor: 'pointer' }}>
          {selected === i && <circle cx={c.x} cy={c.y} r={4.2} fill="#5B3FA6" className="planmap-pulse" />}
          <circle cx={c.x} cy={c.y} r={9} fill="transparent" />
          <circle
            cx={c.x} cy={c.y} r={selected === i ? 5.2 : 4.2} fill="#5B3FA6" stroke="#fff"
            strokeWidth={selected === i ? 1.8 : 1.3} style={{ transition: 'r .15s' }}
          />
          <text x={c.x} y={c.y + 1.5} fontSize={5.5} fontWeight={800} fill="#fff" textAnchor="middle">
            {i + 1}
          </text>
        </g>
      ))}
      {internationalLeg && homePoint && cityPoints[0] && (
        <LegBadge
          x={(homePoint.x + cityPoints[0].x) / 2}
          y={(homePoint.y + cityPoints[0].y) / 2 - Math.min(40, Math.hypot(cityPoints[0].x - homePoint.x, cityPoints[0].y - homePoint.y) * 0.2)}
          info={internationalLeg}
        />
      )}
      {domesticSegments.map((seg, i) =>
        domesticLegs[i] ? <LegBadge key={`badge-${i}`} x={seg.mid.x} y={seg.mid.y} info={domesticLegs[i]} /> : null
      )}
      {selected != null && cityPoints[selected] && (
        <>
          <CityInfoCard
            x={cityPoints[selected].x} y={cityPoints[selected].y} rank={selected + 1}
            city={cities[selected]}
          />
          {(() => {
            const { cardX, cardY } = cardPosition(cityPoints[selected].x, cityPoints[selected].y);
            const cx = cardX + CARD_WIDTH - 12;
            const cy = cardY + 12;
            return (
              <g onClick={() => setSelected(null)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={9} fill="transparent" />
                <line x1={cx - 3} y1={cy - 3} x2={cx + 3} y2={cy + 3} stroke="#5C5C6E" strokeWidth={1.4} strokeLinecap="round" />
                <line x1={cx - 3} y1={cy + 3} x2={cx + 3} y2={cy - 3} stroke="#5C5C6E" strokeWidth={1.4} strokeLinecap="round" />
              </g>
            );
          })()}
        </>
      )}
    </svg>
  );
}
