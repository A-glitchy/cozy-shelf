import type { ReactNode } from "react";

export type Season = "autumn" | "winter" | "spring" | "summer";
export const SEASONS: Season[] = ["autumn", "winter", "spring", "summer"];
export const SEASON_MONTHS: Record<Season, number[]> = { autumn: [9, 10, 11], winter: [12, 1, 2], spring: [3, 4, 5], summer: [6, 7, 8] };
/** Winter belongs to the year it starts in (Dec 2026 + Jan/Feb 2027 = winter 2026). */
export function seasonOf(d = new Date()): { season: Season; year: number } {
  const m = d.getMonth() + 1, y = d.getFullYear();
  if (m >= 3 && m <= 5) return { season: "spring", year: y };
  if (m >= 6 && m <= 8) return { season: "summer", year: y };
  if (m >= 9 && m <= 11) return { season: "autumn", year: y };
  return { season: "winter", year: m === 12 ? y : y - 1 };
}
export const seasonKey = (year: number, s: Season) => `${year}-${s}`;
/** Does a finish date (YYYY-MM-DD) fall inside this season of this year? */
export function inSeason(date: string, year: number, s: Season) {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  if (!SEASON_MONTHS[s].includes(m)) return false;
  return s === "winter" ? (m === 12 ? y === year : y === year + 1) : y === year;
}

const LEAF = "M0,0 C4,-10 18,-10 24,0 C18,10 4,10 0,0Z";
const Svg = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 100 100" className="decor" aria-hidden>{children}</svg>;

// ---------- autumn ----------
const Pumpkin = () => (<Svg>
  <ellipse cx="30" cy="62" rx="20" ry="28" fill="#F59A3A" /><ellipse cx="70" cy="62" rx="20" ry="28" fill="#F59A3A" />
  <ellipse cx="50" cy="62" rx="22" ry="30" fill="#EE7F1C" /><ellipse cx="38" cy="62" rx="12" ry="29" fill="#F28C28" /><ellipse cx="62" cy="62" rx="12" ry="29" fill="#F28C28" />
  <rect x="46" y="26" width="9" height="14" rx="3" fill="#5C7F3B" />
  <path d="M33,60 L41,50 L49,60Z M51,60 L59,50 L67,60Z" fill="#FFD25A" />
  <path d="M34,72 Q50,90 66,72 L60,70 L55,76 L50,71 L45,76 L40,70Z" fill="#FFD25A" /></Svg>);
const Mug = ({ c = "#E0873A" }: { c?: string }) => (<Svg>
  <path d="M24,38 h44 v36 a14,14 0 0 1 -14,14 h-16 a14,14 0 0 1 -14,-14z" fill={c} />
  <path d="M68,46 h6 a10,10 0 0 1 0,22 h-6" fill="none" stroke={c} strokeWidth="7" />
  <ellipse cx="46" cy="38" rx="22" ry="5" fill="#6B3E26" opacity=".6" />
  <path d="M38,28 q-6,-8 0,-14 q6,-6 0,-12 M52,28 q-6,-8 0,-14 q6,-6 0,-12" stroke="#fff" opacity=".6" fill="none" strokeWidth="3" strokeLinecap="round" /></Svg>);
const Candle = ({ c = "#F4E6CD" }: { c?: string }) => (<Svg>
  <rect x="36" y="46" width="28" height="42" rx="4" fill={c} /><path d="M36,56 q4,10 8,2 q2,10 8,0 q4,10 12,-2 v-10 h-28z" fill="#fff" opacity=".35" />
  <rect x="49" y="40" width="2.5" height="8" fill="#5A3E24" /><path d="M50,16 q11,13 0,24 q-11,-11 0,-24z" fill="#FFB347" /><path d="M50,26 q5,6 0,12 q-5,-6 0,-12z" fill="#FFE08A" /></Svg>);
const LeafVase = () => (<Svg>
  <path d="M38,54 h24 l6,38 h-36z" fill="#B07A52" />
  <path d="M50,54 L50,22 M50,50 L36,32 M50,48 L66,30" stroke="#6B4A2B" strokeWidth="3" fill="none" />
  {[["50,26,-80,#D9531E"], ["36,34,-150,#E8A33D"], ["66,32,-20,#B93A1F"], ["50,40,-50,#E8A33D"]].map((s, i) => { const [x, y, r, f] = s[0].split(","); return <g key={i} transform={`translate(${x},${y}) rotate(${r})`}><path d={LEAF} fill={f} /></g>; })}</Svg>);

// ---------- winter ----------
const Pine = () => (<Svg>
  <polygon points="50,10 72,44 28,44" fill="#2F6B4F" /><polygon points="50,28 78,64 22,64" fill="#2A5F46" /><polygon points="50,46 84,86 16,86" fill="#255740" />
  <rect x="45" y="86" width="10" height="10" fill="#6B4A2B" /><polygon points="50,2 53,9 60,9 54,14 56,21 50,17 44,21 46,14 40,9 47,9" fill="#FFD35A" />
  {[[40, 40], [58, 58], [34, 72], [66, 78], [50, 66]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill="#fff" />)}</Svg>);
const Gift = () => (<Svg>
  <rect x="22" y="48" width="56" height="42" fill="#C0392B" /><rect x="46" y="48" width="8" height="42" fill="#F4D35E" /><rect x="18" y="40" width="64" height="12" rx="2" fill="#E04F43" /><rect x="46" y="40" width="8" height="12" fill="#F4D35E" />
  <path d="M50,40 q-18,-20 -22,-6 q4,10 22,6 q18,4 22,-6 q-4,-14 -22,6z" fill="#F4D35E" /></Svg>);

// ---------- spring ----------
const Tulip = ({ x, y, c }: { x: number; y: number; c: string }) => (<g transform={`translate(${x},${y})`}>
  <path d="M0,0 L0,40" stroke="#4F8A4B" strokeWidth="3" /><path d="M0,28 q-12,-4 -14,-18 q8,2 14,18z" fill="#6DAF63" />
  <path d="M-11,-18 q0,16 11,18 q11,-2 11,-18 l-6,6 l-5,-10 l-5,10z" fill={c} /></g>);
const TulipVase = () => (<Svg><path d="M36,56 h28 l5,34 h-38z" fill="#7BC4C4" /><path d="M36,56 h28" stroke="#5BA3A3" strokeWidth="3" />
  <Tulip x={38} y={30} c="#F06B8A" /><Tulip x={50} y={20} c="#FFB347" /><Tulip x={62} y={30} c="#B58AE0" /></Svg>);
const PottedPlant = () => (<Svg>
  <path d="M32,68 h36 l-5,24 h-26z" fill="#C97B50" /><rect x="30" y="64" width="40" height="8" rx="2" fill="#B96A40" />
  {[-50, -20, 10, 40, -80, 70].map((r, i) => <ellipse key={i} cx="50" cy="40" rx="6" ry="20" fill={i % 2 ? "#5FA55A" : "#76BB6C"} transform={`rotate(${r} 50 66)`} />)}</Svg>);
const Teacup = () => (<Svg>
  <ellipse cx="46" cy="82" rx="34" ry="7" fill="#F2C7D6" /><path d="M24,44 h44 v12 a22,22 0 0 1 -44,0z" fill="#FBEFF4" stroke="#E5A7BE" strokeWidth="2" />
  <path d="M68,48 h4 a8,8 0 0 1 0,16 h-6" fill="none" stroke="#E5A7BE" strokeWidth="4" /><circle cx="46" cy="58" r="5" fill="#F7A8C4" /><circle cx="46" cy="58" r="2" fill="#FFD56B" />
  <path d="M38,38 q-5,-7 0,-12 q5,-5 0,-10" stroke="#CBBFC6" fill="none" strokeWidth="3" strokeLinecap="round" /></Svg>);
const Butterfly = () => (<Svg>
  <ellipse cx="32" cy="42" rx="22" ry="16" fill="#F28DB2" transform="rotate(-25 32 42)" /><ellipse cx="68" cy="42" rx="22" ry="16" fill="#F28DB2" transform="rotate(25 68 42)" />
  <ellipse cx="36" cy="64" rx="14" ry="11" fill="#B58AE0" transform="rotate(20 36 64)" /><ellipse cx="64" cy="64" rx="14" ry="11" fill="#B58AE0" transform="rotate(-20 64 64)" />
  <rect x="47" y="34" width="6" height="38" rx="3" fill="#5A4048" /></Svg>);

// ---------- summer ----------
const Sunflower = () => (<Svg><path d="M38,58 h24 l5,32 h-34z" fill="#6FA8DC" /><path d="M50,58 L50,40" stroke="#4F8A4B" strokeWidth="4" />
  <path d="M50,52 q-16,-2 -20,-14 q14,0 20,14z" fill="#6DAF63" />
  {Array.from({ length: 12 }).map((_, i) => <ellipse key={i} cx="50" cy="20" rx="5" ry="11" fill="#F7C531" transform={`rotate(${i * 30} 50 34)`} />)}
  <circle cx="50" cy="34" r="9" fill="#7A4A1E" /></Svg>);
const IcedDrink = () => (<Svg>
  <path d="M30,34 h40 l-5,54 h-30z" fill="#CDEBF7" opacity=".9" /><path d="M32,48 h36 l-3,40 h-30z" fill="#FFB347" />
  <rect x="52" y="12" width="5" height="46" rx="2" transform="rotate(12 54 30)" fill="#E94F6C" />
  <circle cx="68" cy="34" r="11" fill="#FFE066" stroke="#F4B400" strokeWidth="2" /><path d="M68,24 v20 M58,34 h20 M61,27 l14,14 M75,27 l-14,14" stroke="#F4B400" strokeWidth="1" />
  {[[42, 62], [54, 72], [46, 78]].map(([x, y], i) => <rect key={i} x={x} y={y} width="8" height="8" rx="1" fill="#fff" opacity=".55" />)}</Svg>);
const Shell = () => (<Svg>
  <path d="M50,86 L16,50 Q50,12 84,50Z" fill="#F8B7A6" stroke="#E58C7B" strokeWidth="2" />
  {[24, 36, 50, 64, 76].map((x, i) => <path key={i} d={`M50,86 L${x},${i === 2 ? 22 : 30 + Math.abs(i - 2) * 6}`} stroke="#E58C7B" strokeWidth="2" fill="none" />)}
  <rect x="40" y="84" width="20" height="8" rx="3" fill="#E58C7B" /></Svg>);
const Sunglasses = () => (<Svg>
  <circle cx="30" cy="56" r="17" fill="#3A3A4A" /><circle cx="70" cy="56" r="17" fill="#3A3A4A" /><path d="M47,52 q3,-5 6,0" stroke="#3A3A4A" strokeWidth="4" fill="none" />
  <path d="M13,52 L4,44 M87,52 L96,44" stroke="#3A3A4A" strokeWidth="4" /><ellipse cx="24" cy="50" rx="6" ry="3" fill="#fff" opacity=".4" transform="rotate(-30 24 50)" /></Svg>);

// ---------- garlands ----------
function Garland({ kind }: { kind: Season }) {
  const W = 360, pts: string[] = [], items: ReactNode[] = [];
  const y = (x: number) => 12 + 9 * Math.sin(x / 26);
  for (let x = 0; x <= W; x += 6) pts.push(`${x},${y(x).toFixed(1)}`);
  const cols = { autumn: ["#E8761E", "#C0392B", "#E8A33D"], winter: ["#FFFFFF", "#CFE8FF", "#FFFFFF"], spring: ["#F28DB2", "#FFC8DD", "#FFD56B"], summer: ["#FFE066", "#FFD23F", "#FFE066"] }[kind];
  for (let i = 0, x = 14; x < W; x += 30, i++) {
    const yy = y(x), c = cols[i % 3];
    if (kind === "autumn") items.push(<g key={i} transform={`translate(${x},${yy}) rotate(${70 + (i % 3) * 25}) scale(.8)`}><path d={LEAF} fill={c} /></g>);
    else if (kind === "winter") items.push(<g key={i} transform={`translate(${x},${yy + 6})`} stroke={c} strokeWidth="1.6" strokeLinecap="round"><path d="M0,-7 V7 M-6,-3.5 L6,3.5 M-6,3.5 L6,-3.5" /></g>);
    else if (kind === "spring") items.push(<g key={i} transform={`translate(${x},${yy + 5})`}>{[0, 72, 144, 216, 288].map(r => <circle key={r} cx="0" cy="-4.5" r="3.2" fill={c} transform={`rotate(${r})`} />)}<circle r="2" fill="#FFD56B" /></g>);
    else items.push(<g key={i} transform={`translate(${x},${yy + 6})`}><ellipse rx="6" ry="4.4" fill={c} transform="rotate(-20)" /><path d="M5,-3 q4,-3 6,0 q-3,3 -6,0z" fill="#6DAF63" /></g>);
    items.push(<circle key={"l" + i} cx={x + 15} cy={y(x + 15) + 4} r="2.2" fill="#FFE9A0" opacity=".95" />);
  }
  return <svg viewBox={`0 0 ${W} 36`} preserveAspectRatio="none" className="garland" aria-hidden><polyline points={pts.join(" ")} fill="none" stroke="#C9A66B" strokeWidth="1.6" />{items}</svg>;
}

export interface Theme { label: string; emoji: string; wall: string; wood: string; plank: string; ink: string; decor: (() => ReactNode)[] }
export const THEMES: Record<Season, Theme> = {
  autumn: { label: "Autumn", emoji: "🍂", wall: "#5B2A22", wood: "#7A3B2E", plank: "#8E4A39", ink: "#FBE9D0", decor: [Pumpkin, () => <Mug />, LeafVase, () => <Candle />] },
  winter: { label: "Winter", emoji: "❄️", wall: "#1F3A4D", wood: "#3E5A6D", plank: "#52708A", ink: "#EAF4FB", decor: [Pine, () => <Mug c="#C75B5B" />, () => <Candle c="#E8EEF5" />, Gift] },
  spring: { label: "Spring", emoji: "🌸", wall: "#E6D3DF", wood: "#B98F6B", plank: "#A67B58", ink: "#4A3426", decor: [TulipVase, PottedPlant, Teacup, Butterfly] },
  summer: { label: "Summer", emoji: "☀️", wall: "#F4D98B", wood: "#C98B4B", plank: "#B5783A", ink: "#4A3426", decor: [Sunflower, IcedDrink, Shell, Sunglasses] },
};
export const GarlandFor = ({ season }: { season: Season }) => <Garland kind={season} />;
