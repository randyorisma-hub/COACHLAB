/**
 * DEMO CONTENT. Hand-written sample activities used when no AI credentials
 * are configured (or DEMO_MODE=1). Every result produced from this file is
 * labeled origin "demo" and shown with a "Demo" badge in the app — it is not
 * AI-generated and does not respond to the full meaning of the coach's prompt.
 */
import type { Action, Activity, Player, Step } from "../shared/schema";
import { ORIGINAL_ATTRIBUTION } from "../shared/attribution";

export interface DemoContext {
  playerCount: number;
  level: string;
  minutes: number;
}

interface Template {
  key: string;
  tags: string[];
  build: (ctx: DemoContext) => Activity;
}

let seq = 0;
const aid = () => `a${++seq}`;

const P = (id: string, label: string, role: Player["role"], x: number, y: number, name: string | null = null): Player => ({
  id, label, role, x, y, name,
});
const move = (
  type: "cut" | "dribble" | "screen" | "move",
  playerId: string,
  x: number,
  y: number,
  delay: number,
  duration: number,
  opts: { via?: [number, number]; targetId?: string } = {},
): Action => ({
  id: aid(),
  type,
  playerId,
  to: { x, y },
  via: opts.via ? { x: opts.via[0], y: opts.via[1] } : null,
  targetId: opts.targetId ?? null,
  delay,
  duration,
});
const pass = (from: string, to: string, delay: number, duration = 0.7): Action => ({
  id: aid(), type: "pass", playerId: from, to: null, via: null, targetId: to, delay, duration,
});
const shot = (from: string, rebounder: string | null, delay: number, duration = 1): Action => ({
  id: aid(), type: "shot", playerId: from, to: null, via: null, targetId: rebounder, delay, duration,
});
const step = (label: string, note: string, duration: number, actions: Action[]): Step => ({
  id: `s${++seq}`, label, note, duration, actions,
});

/** Waiting players in a line, starting at index `from` (1-based labels). */
function line(prefix: string, role: Player["role"], from: number, count: number, x: number, y: number, dx: number, dy: number, lineName: string): Player[] {
  const out: Player[] = [];
  for (let i = 0; i < count; i++) {
    const n = from + i;
    out.push(P(`${prefix}${n}`, `${prefix}${n}`, role, x + dx * i, y + dy * i, `${lineName} #${n}`));
  }
  return out;
}

const split = (n: number, parts: number) => {
  const base = Math.floor(n / parts);
  return Array.from({ length: parts }, (_, i) => base + (i < n % parts ? 1 : 0));
};

const base = (ctx: DemoContext) => ({
  level: ctx.level,
  playerCount: ctx.playerCount,
  durationMinutes: Math.min(ctx.minutes, 15),
  attribution: ORIGINAL_ATTRIBUTION,
});

const giveAndGo: Template = {
  key: "give-and-go",
  tags: ["pass", "passing", "cut", "cutting", "give", "go", "layup", "finish", "basic", "fundamental", "beginner", "youth"],
  build(ctx) {
    const [na, nb] = split(Math.max(ctx.playerCount, 2), 2);
    const A = line("A", "offense", 1, na, 8, 24, 0, 2.5, "Wing line");
    const B = line("B", "offense", 1, nb, 25, 30, 0, 2.5, "Top line");
    const shiftA = A.slice(1).map((p, i) => move("move", p.id, A[i].x, A[i].y, 0.2, 1));
    const shiftB = B.slice(1).map((p, i) => move("move", p.id, B[i].x, B[i].y, 0.2, 1));
    const rotate: Action[] = [
      move("dribble", "A1", 21, Math.min(B[B.length - 1].y + 2.5, 46), 0, 2),
      move("move", "B1", 4, Math.min(A[A.length - 1].y + 2.5, 46), 0, 2),
      ...shiftA,
      ...shiftB,
    ];
    if (B[1]) rotate.push(pass("A1", "B2", 2.1, 0.7));
    return {
      ...base(ctx),
      id: "demo-give-and-go",
      title: "Give-and-Go Two-Line Passing",
      kind: "drill",
      summary: "Two lines work a V-cut, a crisp entry pass and a basket cut, finishing with a layup. Every player passes, cuts and finishes each rep.",
      objectives: ["Pass to the target hand on time", "Cut hard after every pass", "Finish at the rim at game speed"],
      court: "half",
      equipment: ["1 ball per 4 players", "Cones at the wing and top"],
      setup: [
        `Wing line (A) at the left wing, ${na} players. Top line (B) at the top of the key, ${nb} players.`,
        "First player in the top line starts with the ball.",
      ],
      instructions: [
        "A1 sells a V-cut toward the block, then pops to the wing showing a target hand.",
        "B1 passes to A1 and immediately cuts to the rim (give-and-go).",
        "A1 hits B1 on the cut for a layup, then crashes to rebound.",
        "A1 dribbles out to the back of the top line; B1 jogs to the back of the wing line.",
      ],
      rotations: ["Passer goes to the wing line; the wing player rebounds and dribbles to the top line.", "Switch sides every 2 minutes so players finish with both hands."],
      coachingCues: ["Show a target hand", "Pass and cut — no admiring the pass", "Step through the pass", "Eyes on the rim on the cut"],
      variations: ["Add a passive defender on the cutter", "Require a bounce pass on the give-and-go", "Finish with the off hand only"],
      players: [...A, ...B],
      ballStart: "B1",
      steps: [
        step("V-cut & entry", "Is the V-cut sharp, with a change of speed?", 2.4, [
          move("cut", "A1", 11, 13, 0, 1),
          move("cut", "A1", 7, 19, 1, 0.7),
          pass("B1", "A1", 1.6, 0.7),
        ]),
        step("Give-and-go cut", "Cutter goes the moment the ball leaves the hands.", 2, [
          move("cut", "B1", 22, 6, 0.1, 1.4, { via: [21, 18] }),
          pass("A1", "B1", 1, 0.6),
        ]),
        step("Finish & crash", "Layup off two feet or the correct foot; wing crashes.", 1.6, [
          shot("B1", "A1", 0, 1),
          move("cut", "A1", 19, 9, 0, 1.2),
        ]),
        step("Rotate", "Lines step up while the rebounder dribbles out.", 2.8, rotate),
      ],
    };
  },
};

const screenAway: Template = {
  key: "screen-away",
  tags: ["screen", "screens", "motion", "offense", "play", "cut", "cutting", "curl", "pass", "passing", "spacing", "5", "five"],
  build(ctx) {
    const extras = Math.max(ctx.playerCount - 5, 0);
    const subs = line("S", "neutral", 1, Math.min(extras, 10), 2, 46, 4, 0, "Next group");
    return {
      ...base(ctx),
      id: "demo-screen-away",
      title: "Pass & Screen Away (5-Out)",
      kind: "play",
      summary: "An entry pass, a screen away from the ball and a curl/pop read. Teaches spacing and how to use a screen.",
      objectives: ["Keep 15–18 feet of spacing", "Set legal, stationary screens", "Read the screen: curl or pop"],
      court: "half",
      equipment: ["1 ball", "Pinnies for the next group"],
      setup: [
        "Five players in a 5-out: 1 at the top, 2 and 3 on the wings, 4 and 5 in the corners.",
        extras ? `Remaining ${extras} players wait at half court and sub in by position.` : "Run with five; rotate positions each rep.",
      ],
      instructions: [
        "3 V-cuts and 1 passes to the left wing.",
        "1 screens away for 2 on the right wing.",
        "2 reads the screen and pops to the top; 1 slips to the rim.",
        "3 passes to 2 at the top; 4 lifts to the wing and 1 fills the corner.",
      ],
      rotations: ["Rotate 1→2→3→4→5→bench after each rep; a new group checks in every 3 reps."],
      coachingCues: ["Screener: wide base, hands in, stay still", "Cutter: set up your cut — wait for the screen", "Shoulder to shoulder off the screen", "Refill spots after every cut"],
      variations: ["Add 5 defenders at half speed", "Let 2 choose curl vs. pop based on the defender", "Finish with a scoring option after the reversal"],
      players: [
        P("O1", "1", "offense", 25, 28, "Point"),
        P("O2", "2", "offense", 42, 20, "Right wing"),
        P("O3", "3", "offense", 8, 20, "Left wing"),
        P("O4", "4", "offense", 46, 4, "Right corner"),
        P("O5", "5", "offense", 4, 4, "Left corner"),
        ...subs,
      ],
      ballStart: "O1",
      steps: [
        step("Entry", "Wing must get open with a V-cut before the pass.", 2.4, [
          move("cut", "O3", 11, 10, 0, 1),
          move("cut", "O3", 8, 21, 1, 0.7),
          pass("O1", "O3", 1.6, 0.7),
        ]),
        step("Screen away", "Screener sprints, then stops — no moving screen.", 1.6, [
          move("screen", "O1", 38, 18, 0.1, 1.3, { targetId: "O2" }),
        ]),
        step("Pop & slip", "2 waits for the screen, then pops; screener slips.", 2.4, [
          move("cut", "O2", 26, 26, 0, 1.3, { via: [37, 24] }),
          move("cut", "O1", 30, 8, 0.8, 1.2),
          pass("O3", "O2", 1.4, 0.8),
        ]),
        step("Refill", "Space back out: 4 lifts, 1 fills the corner.", 1.8, [
          move("cut", "O4", 42, 20, 0, 1.2),
          move("move", "O1", 46, 4, 0.2, 1.2),
        ]),
      ],
    };
  },
};

const weave: Template = {
  key: "three-man-weave",
  tags: ["weave", "pass", "passing", "transition", "conditioning", "full", "running", "cut", "cutting", "layup", "warmup"],
  build(ctx) {
    const [nl, nm, nr] = split(Math.max(ctx.playerCount, 3), 3);
    const L = line("L", "offense", 1, nl, 10, 88, 0, 2, "Left lane");
    const M = line("M", "offense", 1, nm, 25, 88, 0, 2, "Middle lane");
    const R = line("R", "offense", 1, nr, 40, 88, 0, 2, "Right lane");
    return {
      ...base(ctx),
      id: "demo-three-man-weave",
      title: "Three-Man Weave",
      kind: "drill",
      summary: "Full-court passing and cutting: pass to a lane, run behind the receiver, finish with a layup.",
      objectives: ["Pass ahead to a moving teammate", "Always go behind the player you passed to", "Finish at speed"],
      court: "full",
      equipment: ["1 ball per group of 3"],
      setup: [`Three lines on the far baseline (${nl}/${nm}/${nr}). Middle line starts with the ball.`],
      instructions: [
        "Middle passes to the right lane and runs behind that player.",
        "The receiver dribbles to the middle and passes to the opposite lane, then runs behind.",
        "Repeat until the last pass leads to a layup; the trailer rebounds.",
      ],
      rotations: ["Shooter goes to the left lane, passer to the middle, rebounder to the right — come back down the sideline.", "Next group goes when the first group crosses half court."],
      coachingCues: ["Pass ahead, not behind", "Go behind your pass", "Stay wide in the lanes", "Call the receiver's name"],
      variations: ["No dribble — passes only", "Add a 2-on-1 going back the other way", "Set a target number of makes in 2 minutes"],
      players: [...L, ...M, ...R],
      ballStart: "M1",
      steps: [
        step("Start & first pass", "Lanes stay wide; pass leads the receiver.", 2.6, [
          move("cut", "L1", 10, 72, 0, 1.6),
          move("cut", "R1", 40, 76, 0, 1),
          move("cut", "M1", 25, 82, 0, 0.6),
          pass("M1", "R1", 0.6, 0.6),
          move("cut", "M1", 40, 68, 0.8, 1.6, { via: [34, 80] }),
          move("dribble", "R1", 25, 70, 1.3, 1.2),
        ]),
        step("Second pass", "Passer cuts behind the receiver every time.", 2.6, [
          pass("R1", "L1", 0, 0.6),
          move("cut", "R1", 10, 56, 0.5, 1.4, { via: [16, 66] }),
          move("dribble", "L1", 25, 56, 0.7, 1.3),
          move("cut", "M1", 40, 56, 0, 1.4),
        ]),
        step("Third pass", "Keep the speed up through half court.", 2.6, [
          pass("L1", "M1", 0, 0.6),
          move("cut", "L1", 40, 40, 0.5, 1.4, { via: [33, 52] }),
          move("dribble", "M1", 25, 40, 0.7, 1.3),
          move("cut", "R1", 10, 40, 0, 1.4),
        ]),
        step("Fourth pass", "Last player through the middle sets up the finish.", 2.6, [
          pass("M1", "R1", 0, 0.6),
          move("cut", "M1", 10, 24, 0.5, 1.4, { via: [17, 36] }),
          move("dribble", "R1", 25, 24, 0.7, 1.3),
          move("cut", "L1", 40, 24, 0, 1.4),
        ]),
        step("Layup", "Pass leads the cutter into a layup; trailer rebounds.", 2.4, [
          move("cut", "L1", 31, 9, 0, 1),
          pass("R1", "L1", 0.4, 0.6),
          shot("L1", "M1", 1.2, 1),
          move("cut", "M1", 20, 7, 0, 1.4),
        ]),
      ],
    };
  },
};

const backdoor: Template = {
  key: "backdoor-read",
  tags: ["backdoor", "cut", "cutting", "denial", "read", "pass", "passing", "bounce", "defense", "pressure"],
  build(ctx) {
    const [nt, nw] = split(Math.max(ctx.playerCount - 1, 2), 2);
    const T = line("T", "offense", 1, nt, 25, 28, 0, 2.5, "Top line");
    const W = line("W", "offense", 1, nw, 44, 24, 0, 2.5, "Wing line");
    return {
      ...base(ctx),
      id: "demo-backdoor-read",
      title: "Backdoor Cut vs. Denial (2-on-1)",
      kind: "drill",
      summary: "A wing walks a denying defender up, then cuts backdoor for a bounce pass. Teaches reading overplay.",
      objectives: ["Recognize a denial", "Plant and cut backdoor", "Deliver a bounce pass away from the defender"],
      court: "half",
      equipment: ["1 ball", "1 pinnie for the defender"],
      setup: [
        `Top line (${nt}) with the ball; wing line (${nw}) on the right. One defender (X) starts denying the first wing.`,
      ],
      instructions: [
        "W1 walks X up the floor toward the passer.",
        "When X's foot and hand are in the passing lane, W1 plants and cuts backdoor.",
        "T1 delivers a bounce pass; W1 finishes. X rebounds.",
        "X outlets to the next passer and the group rotates.",
      ],
      rotations: ["Passer → wing line, wing → defense, defender → back of the top line."],
      coachingCues: ["Walk them up, then explode", "Plant on the outside foot", "Bounce pass beats the hand", "Show a target hand on the cut"],
      variations: ["Defender may play either denial or help — cutter reads it", "Add a second defender on the passer"],
      players: [...T, ...W, P("X", "X", "defense", 38, 19, "Denial defender")],
      ballStart: "T1",
      steps: [
        step("Walk it up", "Defender denies with hand and foot in the lane.", 1.4, [
          move("move", "W1", 42, 26, 0, 1.2),
          move("move", "X", 39, 23.5, 0, 1.2),
        ]),
        step("Backdoor", "Cut when the defender's head turns.", 1.8, [
          move("cut", "W1", 30, 7, 0, 1.1, { via: [41, 15] }),
          move("move", "X", 36, 13, 0.3, 1.1),
          pass("T1", "W1", 0.5, 0.7),
        ]),
        step("Finish", "Defender boxes out and secures the rebound.", 1.4, [
          shot("W1", "X", 0, 1),
          move("move", "X", 28, 9, 0, 1),
        ]),
        step("Rotate", "Outlet to the next passer; everybody rotates.", 2.4, [
          ...(T[1] ? [pass("X", "T2", 0.2, 0.8)] : []),
          move("move", "T1", 46, Math.min(W[W.length - 1].y + 2.5, 46), 0, 1.8),
          move("move", "W1", 38, 19, 0.6, 1.4),
          move("move", "X", 23, Math.min(T[T.length - 1].y + 2.5, 46), 1, 1.4),
        ]),
      ],
    };
  },
};

const pickAndRoll: Template = {
  key: "pick-and-roll",
  tags: ["pick", "roll", "screen", "screens", "ball", "handling", "dribble", "guard", "big", "post", "read", "play"],
  build(ctx) {
    const [ng, nb] = split(Math.max(ctx.playerCount, 2), 2);
    const G = line("G", "offense", 1, ng, 25, 30, 0, 2.5, "Guard line");
    const B = line("B", "offense", 1, nb, 33, 21, 2.5, 2.5, "Screener line");
    return {
      ...base(ctx),
      id: "demo-pick-and-roll",
      title: "Pick-and-Roll Partner Reads",
      kind: "drill",
      summary: "Guard uses a ball screen, the screener rolls, and the guard hits the roll man for a finish.",
      objectives: ["Set up the screen with a jab", "Come off shoulder-to-shoulder", "Roll hard and show a target"],
      court: "half",
      equipment: ["1 ball per pair"],
      setup: [`Guard line (${ng}) at the top with the ball; screener line (${nb}) at the right elbow.`],
      instructions: [
        "B1 sprints up and sets a ball screen on the guard's left side.",
        "G1 jabs away, then dribbles off the screen shoulder-to-shoulder.",
        "B1 rolls to the rim; G1 passes for the finish.",
        "G1 rebounds; switch lines.",
      ],
      rotations: ["Guard → screener line, screener → guard line. Switch sides each round."],
      coachingCues: ["Screener: sprint, stop, wide base", "Guard: wait for the screen", "Roll with hands up", "Pocket pass or bounce pass"],
      variations: ["Add a hedge defender", "Guard reads: pull-up vs. pass", "Screener pops instead of rolling"],
      players: [...G, ...B],
      ballStart: "G1",
      steps: [
        step("Set the screen", "Screener arrives on the ball handler's side and stops.", 1.6, [
          move("screen", "B1", 28.5, 27.5, 0, 1.2, { targetId: "G1" }),
          move("dribble", "G1", 22, 31, 0.3, 0.8),
        ]),
        step("Use it & roll", "Shoulder to shoulder off the screen; screener rolls.", 2.6, [
          move("dribble", "G1", 35, 21, 0, 1.3, { via: [30, 30] }),
          move("cut", "B1", 27, 9, 0.8, 1.1),
          pass("G1", "B1", 1.6, 0.7),
        ]),
        step("Finish", "Roll man finishes strong; guard crashes.", 1.6, [
          shot("B1", "G1", 0, 1),
          move("cut", "G1", 30, 8, 0, 1.2),
        ]),
      ],
    };
  },
};

const shell: Template = {
  key: "shell-defense",
  tags: ["defense", "defensive", "shell", "help", "closeout", "rotation", "rotations", "positioning", "team"],
  build(ctx) {
    const extras = Math.max(ctx.playerCount - 8, 0);
    const subs = line("S", "neutral", 1, Math.min(extras, 10), 2, 46, 4, 0, "Next group");
    return {
      ...base(ctx),
      id: "demo-shell-defense",
      title: "4-on-4 Shell: Help & Close Out",
      kind: "drill",
      summary: "Offense passes around the perimeter; defenders jump to the ball, take help position and close out.",
      objectives: ["Move on the pass, not the catch", "Ball-you-man help position", "Controlled closeouts with high hands"],
      court: "half",
      equipment: ["1 ball", "Pinnies"],
      setup: [
        "Four offensive players: two wings and two guard spots. Four defenders matched up.",
        extras ? `${extras} players wait at half court and rotate in.` : "Rotate offense to defense after each round.",
      ],
      instructions: [
        "Offense passes around the perimeter, holding each catch for two seconds.",
        "On every pass, all four defenders adjust: on-ball, one pass away (deny), two passes away (help).",
        "On the skip pass, the help defender closes out with short choppy steps.",
      ],
      rotations: ["Offense → defense → off; new group on offense. Play to 3 stops."],
      coachingCues: ["Jump to the ball on the pass", "See ball and man", "Short steps, high hands on the closeout", "Talk: 'ball', 'help', 'deny'"],
      variations: ["Allow one dribble penetration", "Live after 4 passes", "Add a post player"],
      players: [
        P("O1", "1", "offense", 19, 26, "Left guard"),
        P("O2", "2", "offense", 31, 26, "Right guard"),
        P("O3", "3", "offense", 7, 17, "Left wing"),
        P("O4", "4", "offense", 43, 17, "Right wing"),
        P("X1", "X1", "defense", 20, 22),
        P("X2", "X2", "defense", 30, 22.5),
        P("X3", "X3", "defense", 10, 15),
        P("X4", "X4", "defense", 34, 13),
        ...subs,
      ],
      ballStart: "O1",
      steps: [
        step("Guard-to-guard", "All four defenders move while the ball is in the air.", 2, [
          pass("O1", "O2", 0, 0.7),
          move("move", "X2", 31, 22, 0, 0.8),
          move("move", "X1", 25, 19, 0, 0.8),
          move("move", "X4", 41, 15, 0, 0.8),
          move("move", "X3", 16, 13, 0, 0.8),
        ]),
        step("To the wing", "Ball on the wing: deny one pass away, help two away.", 2, [
          pass("O2", "O4", 0, 0.7),
          move("move", "X4", 41, 15.5, 0, 0.8),
          move("move", "X2", 32, 21, 0, 0.8),
          move("move", "X1", 23, 13, 0, 0.8),
          move("move", "X3", 19, 9, 0, 0.8),
        ]),
        step("Skip & close out", "Help defender closes out with high hands.", 2.2, [
          pass("O4", "O3", 0, 1),
          move("move", "X3", 9, 15, 0, 1.2),
          move("move", "X1", 17, 22, 0, 1),
          move("move", "X2", 27, 16, 0, 1),
          move("move", "X4", 33, 11, 0, 1),
        ]),
      ],
    };
  },
};

const partnerPassing: Template = {
  key: "partner-passing",
  tags: ["pass", "passing", "warmup", "warm", "chest", "bounce", "beginner", "youth", "fundamental", "catching"],
  build(ctx) {
    const pairs = Math.max(1, Math.min(Math.floor(ctx.playerCount / 2), 8));
    const players: Player[] = [];
    const actions1: Action[] = [];
    const actions2: Action[] = [];
    for (let i = 0; i < pairs; i++) {
      const y = 6 + i * (38 / Math.max(pairs - 1, 1));
      players.push(P(`L${i + 1}`, `L${i + 1}`, "offense", 13, y, `Pair ${i + 1} left`));
      players.push(P(`R${i + 1}`, `R${i + 1}`, "offense", 37, y, `Pair ${i + 1} right`));
    }
    // Only pair 1 is animated in detail; every pair repeats the same pattern.
    actions1.push(move("move", "R1", 35, 6, 0, 0.5), pass("L1", "R1", 0.4, 0.8));
    actions2.push(move("cut", "L1", 15, 10, 0, 0.6), pass("R1", "L1", 0.5, 0.8));
    return {
      ...base(ctx),
      id: "demo-partner-passing",
      title: "Partner Passing Ladder",
      kind: "warmup",
      summary: "Pairs work chest, bounce and one-hand push passes with footwork and a target hand on every catch.",
      objectives: ["Step into every pass", "Catch with two hands and pivot", "Pass to the target hand"],
      court: "half",
      equipment: ["1 ball per pair"],
      setup: [`${pairs} pairs facing each other about 15 feet apart across the lane lines.`],
      instructions: [
        "30 seconds each: chest pass, bounce pass, left-hand push, right-hand push.",
        "Receiver steps to the ball and shows a target hand before every catch.",
        "On the coach's whistle the receiver moves to a new spot and calls for the ball.",
      ],
      rotations: ["Every 2 minutes, the left side slides one pair down to get a new partner."],
      coachingCues: ["Thumbs down on the follow-through", "Bounce two-thirds of the way", "Target hand up", "Step to the pass"],
      variations: ["Add a defender in the middle (monkey in the middle)", "Pass on the move along the sideline"],
      players,
      ballStart: "L1",
      steps: [
        step("Chest pass", "Watch the step and the thumbs-down finish.", 1.6, actions1),
        step("Move & bounce pass", "Receiver relocates and shows a hand.", 1.6, actions2),
      ],
    };
  },
};

export const TEMPLATES: Template[] = [giveAndGo, screenAway, weave, backdoor, pickAndRoll, shell, partnerPassing];

/** Pick the three demo templates whose tags best match the prompt. */
export function pickDemoTemplates(prompt: string): Template[] {
  const words = new Set(prompt.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const scored = TEMPLATES.map((t, i) => ({
    t,
    i,
    score: t.tags.reduce((s, tag) => s + (words.has(tag) || [...words].some((w) => w.startsWith(tag)) ? 1 : 0), 0),
  }));
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, 3).map((s) => s.t);
}
