/** Transition drills. The offense always attacks the basket at the near end (y = 0). */
import { bench, base, line, move, P, pass, shot, step, type BuildContext, type LibraryEntry } from "./dsl";

const BT = "https://www.breakthroughbasketball.com";

export const twoOnOne: LibraryEntry = {
  key: "two-on-one-break",
  category: "transition",
  tags: ["transition", "fast", "break", "2v1", "2-on-1", "outnumber", "layup", "decision", "pass", "full"],
  ages: [10, 18],
  minPlayers: 3,
  defaultPlayers: 9,
  references: [
    { title: "2-on-1 continuous transition drill (Coach's Clipboard)", url: "https://www.coachesclipboard.net/2on1TransitionDrill.html" },
    { title: "2 on 1 continuous (Breakthrough Basketball)", url: `${BT}/playcreator/view.asp?id=81&type=drill` },
  ],
  build(ctx: BuildContext) {
    const q = Math.max(ctx.playerCount - 3, 0);
    return {
      ...base(ctx),
      id: "lib-two-on-one-break",
      title: "2-on-1 Fast Break",
      kind: "drill",
      summary: "Two attackers push against one defender; the ball handler drives until the defender commits, then passes for a layup.",
      objectives: ["Stay wide to stretch the defender", "Attack until the defender commits", "Finish without a dribble if possible"],
      court: "full",
      equipment: ["1 ball"],
      setup: ["Two offensive players start at the far free-throw line extended, one defender waits in the near paint. Others wait at the far baseline."],
      instructions: [
        "Ball handler pushes up one side of the floor; partner sprints the other lane.",
        "Defender stops the ball high, then tries to recover.",
        "Ball handler attacks the defender's inside shoulder; when the defender commits, pass ahead for a layup.",
        "Continuous version: the defender and the shooter go 2-on-1 the other way against a new defender.",
      ],
      rotations: ["Shooter becomes the next defender; the defender and passer join the far line."],
      coachingCues: ["Wide lanes, wide angles", "Make the defender commit", "Pass early, not late", "Defender: fake and bluff"],
      variations: ["No dribble for the wing", "Add a trailing defender from half court (2-on-1 + 1)"],
      players: [
        P("A", "A", "offense", 15, 72, "Ball handler"),
        P("B", "B", "offense", 38, 72, "Wing"),
        P("X", "X", "defense", 25, 18, "Defender"),
        ...line("Q", "neutral", 1, Math.min(q, 10), 4, 92, 4.4, 0, "Next group"),
      ],
      ballStart: "A",
      steps: [
        step("Push", "Ball handler pushes; wing sprints wide.", 2.4, [
          move("dribble", "A", 20, 28, 0, 2.3),
          move("cut", "B", 42, 24, 0, 2.2),
          move("move", "X", 22, 22, 1.2, 1),
        ]),
        step("Commit & pass", "When the defender commits, pass ahead.", 1.4, [
          move("move", "X", 21, 24, 0, 0.5),
          move("cut", "B", 32, 9, 0.2, 1.1),
          pass("A", "B", 0.5, 0.7),
        ]),
        step("Layup", "Finish; defender rebounds.", 1.2, [shot("B", "X", 0, 1), move("move", "X", 26, 8, 0, 1)]),
      ],
    };
  },
};

export const threeOnTwoNoDribble: LibraryEntry = {
  key: "three-on-two-no-dribble",
  category: "transition",
  tags: ["transition", "3v2", "3-on-2", "pass", "passing", "no", "dribble", "decision", "full", "fast", "break", "tandem"],
  ages: [10, 18],
  minPlayers: 5,
  defaultPlayers: 10,
  references: [{ title: "3 on 2 full court no dribble (Breakthrough Basketball)", url: `${BT}/drills/passing-and-decission-making-drill` }],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-three-on-two-no-dribble",
      title: "3-on-2 No-Dribble Break",
      kind: "drill",
      summary: "Three attackers advance the ball the length of the floor with passes only against two tandem defenders.",
      objectives: ["Move the ball ahead with the pass", "Fill three lanes", "Read the tandem defense and find the open player"],
      court: "full",
      equipment: ["1 ball"],
      setup: ["Three offensive players at the far baseline in three lanes. Two defenders in tandem at the near end: one at the free-throw line, one under the basket."],
      instructions: [
        "Offense advances with passes only. Every player must catch on the move.",
        "Top defender stops the ball; bottom defender takes the first pass.",
        "Offense finds the open player for a layup.",
      ],
      rotations: ["The two defenders and the shooter go 2-on-1 back the other way, or rotate offense to defense."],
      coachingCues: ["Pass ahead, the ball moves faster than you", "Stay in your lane", "Catch and pass on the move", "Middle stops at the free-throw line"],
      variations: ["Allow one dribble per player", "Add a third defender sprinting back from half court"],
      players: [
        P("L", "L", "offense", 8, 88, "Left lane"),
        P("M", "M", "offense", 25, 90, "Middle"),
        P("R", "R", "offense", 42, 88, "Right lane"),
        P("X1", "X1", "defense", 25, 22, "Top defender"),
        P("X2", "X2", "defense", 25, 8, "Bottom defender"),
        ...bench(ctx.playerCount - 5, 93),
      ],
      ballStart: "M",
      steps: [
        step("Push ahead", "First pass ahead to a lane; passer runs after the pass.", 2, [
          move("cut", "L", 8, 66, 0, 1.4),
          move("cut", "R", 42, 62, 0, 1.6),
          pass("M", "L", 0.6, 0.8),
          move("cut", "M", 25, 58, 0.8, 1.2),
        ]),
        step("Swing", "Catch, pass back to the middle, run your lane.", 2.8, [
          pass("L", "M", 0.1, 0.7),
          move("cut", "L", 8, 40, 0.8, 1.2),
          move("cut", "R", 42, 36, 0, 1.2),
          pass("M", "R", 1, 0.7),
          move("cut", "M", 25, 26, 1.6, 1.2),
        ]),
        step("Attack the tandem", "Ball to the middle at the free-throw line; top defender stops it.", 2.2, [
          pass("R", "M", 0.2, 0.8),
          move("move", "X1", 25, 22, 0.2, 0.8),
          move("cut", "L", 10, 18, 0, 1.4),
          move("cut", "R", 40, 18, 0.9, 1.2),
        ]),
        step("Kick & skip", "Bottom defender takes the wing: skip to the weak side.", 2, [
          pass("M", "R", 0, 0.7),
          move("move", "X2", 36, 11, 0, 0.9),
          pass("R", "L", 0.9, 1),
          move("cut", "L", 19, 7, 1, 0.9),
          move("move", "X2", 27, 8, 1.2, 0.8),
        ]),
        step("Finish", "Layup; defense rebounds.", 1.2, [shot("L", "X2", 0, 1)]),
      ],
    };
  },
};

export const outletFillLanes: LibraryEntry = {
  key: "outlet-fill-lanes-5v0",
  category: "transition",
  tags: ["transition", "outlet", "lanes", "fill", "fast", "break", "5", "team", "rim", "run", "trailer", "full", "conditioning"],
  ages: [11, 18],
  minPlayers: 5,
  defaultPlayers: 10,
  references: [{ title: "Youth offense & transition drills (Breakthrough Basketball)", url: `${BT}/drills/kids-youth` }],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-outlet-fill-lanes-5v0",
      title: "5-on-0 Outlet & Fill the Lanes",
      kind: "drill",
      summary: "After a rebound, the team outlets, fills five lanes and scores in under 7 seconds without a defense.",
      objectives: ["Outlet to the side, not the middle", "Run wide lanes; the big runs to the rim", "Score quickly with the first open look"],
      court: "full",
      equipment: ["1 ball", "Stopwatch"],
      setup: ["Five players at the far end as if after a defensive rebound: 4 has the ball under the far basket."],
      instructions: [
        "4 rebounds and outlets to 1 on the sideline.",
        "1 pushes up the middle; 2 and 3 sprint wide; 5 sprints to the rim; 4 trails.",
        "Wing catches and finds 5 at the rim for a layup.",
      ],
      rotations: ["Next five go on the make. Rotate positions every trip."],
      coachingCues: ["Outlet to the sideline", "Sprint wide — touch the sideline", "5 runs rim to rim", "Score in 7 seconds"],
      variations: ["Add two defenders at the near end (5-on-2)", "Trailer three for the 4"],
      players: [
        P("O1", "1", "offense", 42, 80, "Point guard"),
        P("O2", "2", "offense", 8, 78, "Wing"),
        P("O3", "3", "offense", 44, 70, "Wing"),
        P("O4", "4", "offense", 28, 89, "Rebounder"),
        P("O5", "5", "offense", 20, 86, "Rim runner"),
        ...bench(ctx.playerCount - 5, 93),
      ],
      ballStart: "O4",
      steps: [
        step("Outlet", "Pivot to the sideline and outlet.", 1.4, [pass("O4", "O1", 0.2, 0.9)]),
        step("Push & fill", "Middle, wide, rim, trail.", 2.6, [
          move("dribble", "O1", 25, 52, 0, 2.4, { via: [36, 64] }),
          move("cut", "O2", 4, 34, 0, 2.4),
          move("cut", "O3", 46, 34, 0, 2.4),
          move("cut", "O5", 24, 40, 0, 2.4),
          move("cut", "O4", 30, 64, 0.3, 2.2),
        ]),
        step("Ahead to the wing", "Hit the wing early.", 2, [
          move("cut", "O3", 46, 30, 0, 0.8),
          pass("O1", "O3", 0, 0.8),
          move("dribble", "O3", 44, 22, 0.9, 0.8),
          move("cut", "O5", 25, 9, 0, 1.8),
          move("cut", "O2", 5, 20, 0, 1.5),
          move("cut", "O4", 30, 30, 0, 1.8),
        ]),
        step("Rim run", "Wing finds the rim runner; trailer crashes.", 1.4, [pass("O3", "O5", 0, 0.8), move("cut", "O4", 30, 13, 0, 1.3)]),
        step("Score", "Layup; trailer rebounds.", 1.2, [shot("O5", "O4", 0, 1)]),
      ],
    };
  },
};

export const reboundOutlet: LibraryEntry = {
  key: "rebound-and-outlet",
  category: "transition",
  tags: ["rebound", "outlet", "pass", "pivot", "transition", "wing", "push", "beginner", "youth"],
  ages: [9, 16],
  minPlayers: 3,
  defaultPlayers: 8,
  references: [{ title: "Youth basketball drills & practice plans (YMCA, PDF)", url: "https://ymcanwnc.org/sites/default/files/2021-09/Youth-Basketball-Drills-and-Practice-Plans.pdf" }],
  build(ctx: BuildContext) {
    const n = Math.max(ctx.playerCount - 1, 2);
    const half = Math.ceil(n / 2);
    const R = line("R", "offense", 1, half, 12, 3, -2.4, 0, "Rebound line");
    const W = line("W", "offense", 1, n - half, 45, 12, 1.2, 2.4, "Outlet line");
    return {
      ...base(ctx),
      id: "lib-rebound-and-outlet",
      title: "Rebound, Pivot & Outlet",
      kind: "drill",
      summary: "Rebounder secures a missed shot, pivots to the sideline and hits the outlet, who pushes up the floor.",
      objectives: ["Rebound with two hands at the highest point", "Pivot away from pressure toward the sideline", "Outlet catches facing up court"],
      court: "half",
      equipment: ["1 ball", "Coach shooting"],
      setup: [`Rebound line (${half}) on the left baseline, outlet line (${n - half}) on the right sideline. Coach shoots from the left elbow.`],
      instructions: [
        "Coach shoots; the rebounder goes up and secures the ball.",
        "Rebounder pivots to the right sideline; outlet comes back to the ball.",
        "Outlet catches with back to the sideline and speed-dribbles to half court.",
      ],
      rotations: ["Rebounder → outlet line → rebound line."],
      coachingCues: ["Two hands, chin it", "Pivot to the sideline", "Outlet: come back, open up", "Catch and go"],
      variations: ["Add a defender pressuring the rebounder", "Outlet throws ahead to a third player"],
      players: [P("C", "C", "coach", 19, 19, "Shooter"), ...R, ...W],
      ballStart: "C",
      steps: [
        step("Shot & rebound", "Go get it at its highest point.", 1.6, [shot("C", "R1", 0, 1.4), move("cut", "R1", 27, 7, 0.2, 1)]),
        step("Pivot & outlet", "Pivot to the sideline, pass to the outlet.", 1.8, [
          move("move", "R1", 28, 7.5, 0, 0.4),
          move("cut", "W1", 44, 20, 0, 0.9),
          pass("R1", "W1", 0.9, 0.8),
        ]),
        step("Push", "Speed dribble up the sideline.", 1.8, [move("dribble", "W1", 42, 45, 0, 1.7)]),
      ],
    };
  },
};

export const TRANSITION: LibraryEntry[] = [twoOnOne, threeOnTwoNoDribble, outletFillLanes, reboundOutlet];
