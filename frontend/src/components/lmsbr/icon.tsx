"use client";

type S = { t?: string; d?: string; cx?: number; cy?: number; r?: number; x?: number; y?: number; rx?: number; width?: number; height?: number; x1?: number; y1?: number; x2?: number; y2?: number; points?: string; };

const ICONS: Record<string, S[]> = {
  grid: [{t:"rect",x:3,y:3,width:7,height:7,rx:1.6},{t:"rect",x:14,y:3,width:7,height:7,rx:1.6},{t:"rect",x:3,y:14,width:7,height:7,rx:1.6},{t:"rect",x:14,y:14,width:7,height:7,rx:1.6}],
  home: [{d:"M3 10.5 12 3l9 7.5"},{d:"M5 9.5V20h14V9.5"}],
  shield: [{d:"M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z"},{d:"M9 11.5l2 2 4-4.5"}],
  alert: [{d:"M12 3.5 21 19H3z"},{t:"line",x1:12,y1:10,x2:12,y2:14},{t:"line",x1:12,y1:16.5,x2:12,y2:16.6}],
  users: [{t:"circle",cx:9,cy:8,r:3},{d:"M3.5 20a5.5 5.5 0 0 1 11 0"},{t:"circle",cx:17,cy:9,r:2.3},{d:"M15.5 20a4 4 0 0 1 6-3.3"}],
  chart: [{t:"line",x1:4,y1:4,x2:4,y2:20},{t:"line",x1:4,y1:20,x2:20,y2:20},{t:"polyline",points:"7 14 11 9 14 12 19 6"}],
  clipboard: [{t:"rect",x:5,y:4.5,width:14,height:16.5,rx:2},{t:"rect",x:9,y:2.6,width:6,height:4,rx:1.2},{t:"line",x1:8.5,y1:11,x2:15.5,y2:11},{t:"line",x1:8.5,y1:15,x2:13,y2:15}],
  list: [{t:"line",x1:9,y1:6,x2:20,y2:6},{t:"line",x1:9,y1:12,x2:20,y2:12},{t:"line",x1:9,y1:18,x2:20,y2:18},{t:"circle",cx:4.5,cy:6,r:1.1},{t:"circle",cx:4.5,cy:12,r:1.1},{t:"circle",cx:4.5,cy:18,r:1.1}],
  send: [{d:"M21 3 10.5 13.5"},{d:"M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z"}],
  calendar: [{t:"rect",x:4,y:5,width:16,height:16,rx:2},{t:"line",x1:4,y1:9.5,x2:20,y2:9.5},{t:"line",x1:9,y1:3,x2:9,y2:6},{t:"line",x1:15,y1:3,x2:15,y2:6}],
  badge: [{t:"circle",cx:12,cy:9,r:6},{d:"M8.5 14l-1 7 4.5-2.6L16.5 21l-1-7"}],
  archive: [{t:"rect",x:3,y:4,width:18,height:4.6,rx:1.4},{d:"M5 8.6V20h14V8.6"},{t:"line",x1:10,y1:13,x2:14,y2:13}],
  box: [{d:"M21 8l-9-5-9 5 9 5 9-5z"},{d:"M3 8v8l9 5 9-5V8"},{t:"line",x1:12,y1:13,x2:12,y2:21}],
  folder: [{d:"M4 6.5A2 2 0 0 1 6 4.5h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5z"}],
  file: [{t:"path",d:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"},{t:"polyline",points:"14 2 14 8 20 8"}],
  edit: [{d:"M12 20h9"},{d:"M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"}],
  delete: [{d:"M3 6h18"},{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"},{t:"path",d:"M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"},{t:"line",x1:10,y1:11,x2:10,y2:17},{t:"line",x1:14,y1:11,x2:14,y2:17}],
  check: [{t:"circle",cx:12,cy:12,r:9},{t:"polyline",points:"8 12 11 15 16 9"}],
  search: [{t:"circle",cx:11,cy:11,r:7},{t:"line",x1:16.5,y1:16.5,x2:21,y2:21}],
  bell: [{d:"M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7z"},{d:"M10.3 20a2 2 0 0 0 3.4 0"}],
  logout: [{d:"M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8"},{t:"line",x1:10,y1:12,x2:21,y2:12},{t:"polyline",points:"17 8 21 12 17 16"}],
  chevron: [{t:"polyline",points:"9 6 15 12 9 18"}],
  chevdown: [{t:"polyline",points:"6 9 12 15 18 9"}],
  close: [{t:"line",x1:6,y1:6,x2:18,y2:18},{t:"line",x1:18,y1:6,x2:6,y2:18}],
  plus: [{t:"line",x1:12,y1:5,x2:12,y2:19},{t:"line",x1:5,y1:12,x2:19,y2:12}],
  map: [{t:"polygon",points:"3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"},{t:"line",x1:9,y1:3,x2:9,y2:18},{t:"line",x1:15,y1:6,x2:15,y2:21}],
  clock: [{t:"circle",cx:12,cy:12,r:9},{t:"polyline",points:"12 7 12 12 15.5 14"}],
  target: [{t:"circle",cx:12,cy:12,r:9},{t:"circle",cx:12,cy:12,r:5},{t:"circle",cx:12,cy:12,r:1.3}],
  gear: [{d:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"},{d:"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"}],
  sidebar: [{t:"rect",x:3,y:4,width:18,height:16,rx:2},{t:"line",x1:9,y1:4,x2:9,y2:20}],
  header: [{t:"rect",x:3,y:4,width:18,height:16,rx:2},{t:"line",x1:3,y1:10,x2:21,y2:10}],
  menu: [{t:"line",x1:4,y1:7,x2:20,y2:7},{t:"line",x1:4,y1:12,x2:20,y2:12},{t:"line",x1:4,y1:17,x2:20,y2:17}],
  arrow: [{t:"line",x1:5,y1:12,x2:19,y2:12},{t:"polyline",points:"13 6 19 12 13 18"}],
  open: [{d:"M7 17 17 7"},{t:"polyline",points:"8 7 17 7 17 16"}],
  dot: [{t:"circle",cx:12,cy:12,r:2.2}],
  palette: [{d:"M12 3c-4 0-7 2.5-7 6.5 0 2.2 1.2 4 3 5.2-.3.8-.5 1.6-.5 2.3 0 .6.4 1 1 1h6.5c.6 0 1-.4 1-1 0-.7-.2-1.5-.5-2.3 1.8-1.2 3-3 3-5.2C19 5.5 16 3 12 3z"},{t:"circle",cx:8.5,cy:8.5,r:1.1},{t:"circle",cx:12,cy:7,r:1.1},{t:"circle",cx:15.5,cy:9,r:1.1}],
  sun: [{t:"circle",cx:12,cy:12,r:4.5},{t:"line",x1:12,y1:2,x2:12,y2:4},{t:"line",x1:12,y1:20,x2:12,y2:22},{t:"line",x1:4.93,y1:4.93,x2:6.34,y2:6.34},{t:"line",x1:17.66,y1:17.66,x2:19.07,y2:19.07},{t:"line",x1:2,y1:12,x2:4,y2:12},{t:"line",x1:20,y1:12,x2:22,y2:12},{t:"line",x1:4.93,y1:19.07,x2:6.34,y2:17.66},{t:"line",x1:17.66,y1:6.34,x2:19.07,y2:4.93}],
  moon: [{d:"M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"}],
  mail: [{t:"rect",x:3,y:5,width:18,height:14,rx:2},{d:"M3 7l9 6 9-6"}],
  lock: [{t:"rect",x:5,y:11,width:14,height:10,rx:2},{d:"M8 11V8a4 4 0 0 1 8 0v3"}],
  more: [{t:"circle",cx:12,cy:5,r:1.4},{t:"circle",cx:12,cy:12,r:1.4},{t:"circle",cx:12,cy:19,r:1.4}],
};

function Shape({ s, sw }: { s: S; sw: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const tag = s.t || "path";
  if (tag === "rect") return <rect {...common} x={s.x} y={s.y} rx={s.rx} width={s.width} height={s.height} />;
  if (tag === "circle") return <circle {...common} cx={s.cx} cy={s.cy} r={s.r} />;
  if (tag === "line") return <line {...common} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />;
  if (tag === "polyline") return <polyline {...common} points={s.points} />;
  if (tag === "polygon") return <polygon {...common} points={s.points} />;
  return <path {...common} d={s.d} />;
}

export function Icon({ name, size = 20, sw = 1.8 }: { name: string; size?: number; sw?: number }) {
  const shapes = ICONS[name] || ICONS.dot;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {shapes.map((s, i) => <Shape key={i} s={s} sw={sw} />)}
    </svg>
  );
}
