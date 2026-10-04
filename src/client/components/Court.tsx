import { useRef, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { actionStartPoint, passEndPoint, pointOnPath, type Frame, type Timeline } from "../../shared/engine";
import { COURT_WIDTH, FULL_COURT_LENGTH, HALF_COURT_LENGTH, HOOP, type Action, type Player, type Point } from "../../shared/schema";

export type DragTarget =
  | { kind: "player"; id: string }
  | { kind: "to"; stepIndex: number; actionId: string }
  | { kind: "via"; stepIndex: number; actionId: string };

interface Props {
  timeline: Timeline;
  frame: Frame;
  /** Step whose action paths are drawn (-1 = none / setup). */
  pathStep: number;
  editable?: boolean;
  selectedActionId?: string | null;
  onDrag?: (target: DragTarget, p: Point, phase: "move" | "end") => void;
  onSelectAction?: (stepIndex: number, actionId: string) => void;
}

const PAD = 2;
const PLAYER_R = 1.6;

export function Court({ timeline, frame, pathStep, editable, selectedActionId, onDrag, onSelectAction }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<DragTarget | null>(null);
  const { activity } = timeline;
  const length = activity.court === "full" ? FULL_COURT_LENGTH : HALF_COURT_LENGTH;
  const step = pathStep >= 0 ? activity.steps[pathStep] : undefined;

  const toCourt = (e: ReactPointerEvent): Point | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return {
      x: Math.round(Math.min(Math.max(p.x, 0), COURT_WIDTH) * 10) / 10,
      y: Math.round(Math.min(Math.max(p.y, 0), length) * 10) / 10,
    };
  };

  const startDrag = (target: DragTarget) => (e: ReactPointerEvent) => {
    if (!editable || !onDrag) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = target;
  };
  const moveDrag = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    const p = toCourt(e);
    if (p) onDrag?.(dragging.current, p, "move");
  };
  const endDrag = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    const p = toCourt(e);
    if (p) onDrag?.(dragging.current, p, "end");
    dragging.current = null;
  };

  const playersById = new Map(activity.players.map((p) => [p.id, p]));
  const holderId = frame.ball?.holderId ?? null;

  return (
    <svg
      ref={svgRef}
      className={`court ${editable ? "court--editable" : ""}`}
      viewBox={`${-PAD} ${-PAD} ${COURT_WIDTH + PAD * 2} ${length + PAD * 2}`}
      role="img"
      aria-label={`Court diagram for ${activity.title}`}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <defs>
        {(["cut", "pass", "dribble", "move", "shot"] as const).map((t) => (
          <marker key={t} id={`arrow-${t}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className={`arrowhead arrowhead--${t}`} />
          </marker>
        ))}
      </defs>

      <CourtLines length={length} />

      {step && (
        <g className="paths">
          {step.actions.map((a) => (
            <ActionPath
              key={a.id}
              action={a}
              timeline={timeline}
              stepIndex={pathStep}
              selected={a.id === selectedActionId}
              onSelect={onSelectAction ? () => onSelectAction(pathStep, a.id) : undefined}
            />
          ))}
        </g>
      )}

      {frame.players.map((pf) => {
        const p = playersById.get(pf.id)!;
        return (
          <PlayerMarker
            key={pf.id}
            player={p}
            x={pf.x}
            y={pf.y}
            hasBall={holderId === pf.id}
            draggable={!!editable}
            onPointerDown={startDrag({ kind: "player", id: pf.id })}
          />
        );
      })}

      {frame.ball && (
        <g className={`ball ${frame.ball.inFlight ? "ball--flight" : ""}`} transform={`translate(${frame.ball.x} ${frame.ball.y})`}>
          <circle r={0.75} />
          <path d="M-0.75,0 H0.75 M0,-0.75 V0.75" />
        </g>
      )}

      {editable && step && (
        <g className="handles">
          {step.actions
            .filter((a) => a.to)
            .map((a) => {
              const selected = a.id === selectedActionId;
              return (
                <g key={a.id}>
                  {selected && a.via && (
                    <circle
                      className="handle handle--via"
                      cx={a.via.x}
                      cy={a.via.y}
                      r={1}
                      onPointerDown={startDrag({ kind: "via", stepIndex: pathStep, actionId: a.id })}
                    >
                      <title>Drag to bend the path</title>
                    </circle>
                  )}
                  <rect
                    className={`handle ${selected ? "handle--selected" : ""}`}
                    x={a.to!.x - 0.9}
                    y={a.to!.y - 0.9}
                    width={1.8}
                    height={1.8}
                    transform={`rotate(45 ${a.to!.x} ${a.to!.y})`}
                    onPointerDown={(e) => {
                      onSelectAction?.(pathStep, a.id);
                      startDrag({ kind: "to", stepIndex: pathStep, actionId: a.id })(e);
                    }}
                  >
                    <title>Drag to change where this {a.type} ends</title>
                  </rect>
                </g>
              );
            })}
        </g>
      )}
    </svg>
  );
}

function CourtLines({ length }: { length: number }) {
  const half = (
    <g className="court-lines">
      {/* lane, free-throw circle, backboard, rim, restricted area, three-point line */}
      <rect x={17} y={0} width={16} height={19} />
      <circle cx={25} cy={19} r={6} />
      <line x1={22} y1={4} x2={28} y2={4} className="backboard" />
      <circle cx={HOOP.x} cy={HOOP.y} r={0.75} className="rim" />
      <path d={`M21,${HOOP.y} A4,4 0 0 0 29,${HOOP.y}`} />
      <path d={`M3,0 V${HOOP.y} A22,22 0 0 0 47,${HOOP.y} V0`} />
      {[7, 8, 11, 14].map((y) => (
        <g key={y}>
          <line x1={16.3} y1={y} x2={17} y2={y} />
          <line x1={33} y1={y} x2={33.7} y2={y} />
        </g>
      ))}
    </g>
  );
  return (
    <g>
      <rect className="court-floor" x={0} y={0} width={COURT_WIDTH} height={length} />
      <g className="court-lines">
        <rect x={0} y={0} width={COURT_WIDTH} height={length} />
        <path d={`M19,47 A6,6 0 0 0 31,47`} />
        {length > HALF_COURT_LENGTH && (
          <>
            <line x1={0} y1={47} x2={50} y2={47} />
            <path d={`M19,47 A6,6 0 0 1 31,47`} />
          </>
        )}
      </g>
      {half}
      {length > HALF_COURT_LENGTH && <g transform={`translate(0 ${FULL_COURT_LENGTH}) scale(1 -1)`}>{half}</g>}
    </g>
  );
}

function PlayerMarker({
  player,
  x,
  y,
  hasBall,
  draggable,
  onPointerDown,
}: {
  player: Player;
  x: number;
  y: number;
  hasBall: boolean;
  draggable: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
}) {
  const fontSize = player.label.length >= 3 ? 1.05 : player.label.length === 2 ? 1.3 : 1.6;
  return (
    <g
      className={`player player--${player.role} ${hasBall ? "player--ball" : ""} ${draggable ? "player--draggable" : ""}`}
      transform={`translate(${x} ${y})`}
      onPointerDown={onPointerDown}
    >
      <title>{`${player.label}${player.name ? ` — ${player.name}` : ""} (${player.role})`}</title>
      {hasBall && <circle className="player-ring" r={PLAYER_R + 0.55} />}
      {player.role === "coach" ? (
        <rect x={-PLAYER_R} y={-PLAYER_R} width={PLAYER_R * 2} height={PLAYER_R * 2} rx={0.4} />
      ) : (
        <circle r={PLAYER_R} />
      )}
      <text textAnchor="middle" dominantBaseline="central" fontSize={fontSize}>
        {player.label}
      </text>
    </g>
  );
}

function ActionPath({
  action,
  timeline,
  stepIndex,
  selected,
  onSelect,
}: {
  action: Action;
  timeline: Timeline;
  stepIndex: number;
  selected: boolean;
  onSelect?: () => void;
}) {
  const from = actionStartPoint(timeline, stepIndex, action);
  let d = "";
  let extra: ReactElement | null = null;
  const cls = `path path--${action.type} ${selected ? "path--selected" : ""}`;

  if (action.type === "pass") {
    const to = passEndPoint(timeline, stepIndex, action);
    if (!to) return null;
    const end = shorten(from, to, PLAYER_R + 0.3);
    const start = shorten(to, from, PLAYER_R * 0.6);
    d = `M${start.x},${start.y} L${end.x},${end.y}`;
  } else if (action.type === "shot") {
    const end = shorten(from, HOOP, 0.9);
    d = `M${from.x},${from.y} L${end.x},${end.y}`;
  } else if (action.to) {
    const pts = sample(from, action.to, action.via, 24);
    if (action.type === "dribble") d = zigzag(pts);
    else d = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
    if (action.type === "screen") {
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = (-(b.y - a.y) / len) * 1.3;
      const ny = ((b.x - a.x) / len) * 1.3;
      extra = <line className="path path--screen-bar" x1={b.x + nx} y1={b.y + ny} x2={b.x - nx} y2={b.y - ny} />;
    }
  }
  const marker = action.type === "screen" ? undefined : `url(#arrow-${action.type})`;
  return (
    <g onClick={onSelect} className="path-group">
      {/* wide invisible stroke makes paths easy to tap */}
      <path d={d} className="path-hit" />
      <path d={d} className={cls} markerEnd={marker} />
      {extra}
    </g>
  );
}

function shorten(from: Point, to: Point, by: number): Point {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len <= by) return to;
  const u = (len - by) / len;
  return { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u };
}

function sample(from: Point, to: Point, via: Point | null, n: number): Point[] {
  return Array.from({ length: n + 1 }, (_, i) => pointOnPath(from, to, via, i / n));
}

/** Zig-zag line along a sampled path (the standard diagram symbol for a dribble). */
function zigzag(pts: Point[]): string {
  const out: Point[] = [pts[0]];
  const amp = 0.55;
  for (let i = 1; i < pts.length - 2; i++) {
    const a = pts[i - 1];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const s = i % 2 ? amp : -amp;
    out.push({ x: pts[i].x + (-(b.y - a.y) / len) * s, y: pts[i].y + ((b.x - a.x) / len) * s });
  }
  out.push(pts[pts.length - 1]);
  return out.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

export function Legend() {
  const items: [Action["type"], string][] = [
    ["cut", "Cut"],
    ["pass", "Pass"],
    ["dribble", "Dribble"],
    ["screen", "Screen"],
    ["move", "Move / jog"],
    ["shot", "Shot"],
  ];
  return (
    <ul className="legend" aria-label="Diagram legend">
      {items.map(([t, label]) => (
        <li key={t}>
          <svg viewBox="0 0 24 8" width="40" height="14" aria-hidden="true">
            {t === "dribble" ? (
              <path className={`path path--${t}`} d="M1,4 L4,2.6 L7,5.4 L10,2.6 L13,5.4 L16,2.6 L19,4" />
            ) : (
              <path className={`path path--${t}`} d="M1,4 L19,4" />
            )}
            {t === "screen" ? <line className="path path--screen-bar" x1={19} y1={1} x2={19} y2={7} /> : <path d="M19,1.5 L23,4 L19,6.5 z" className={`arrowhead arrowhead--${t}`} />}
          </svg>
          {label}
        </li>
      ))}
      <li>
        <svg viewBox="0 0 8 8" width="14" height="14" aria-hidden="true">
          <circle cx={4} cy={4} r={3} className="legend-ball" />
        </svg>
        Ball
      </li>
    </ul>
  );
}
