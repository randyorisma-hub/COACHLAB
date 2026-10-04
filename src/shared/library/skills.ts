/** Individual skills: ball handling, footwork and finishing. */
import { base, line, move, P, pass, shot, split, step, type BuildContext, type LibraryEntry } from "./dsl";

const BT = "https://www.breakthroughbasketball.com";

export const zigZagDribble: LibraryEntry = {
  key: "zig-zag-dribble",
  category: "ball-handling",
  tags: ["dribble", "dribbling", "ball", "handling", "crossover", "change", "direction", "full", "warmup", "beginner", "youth"],
  ages: [7, 15],
  minPlayers: 1,
  defaultPlayers: 8,
  references: [{ title: "Zig zag agility drill (Breakthrough Basketball)", url: `${BT}/playcreator/view.asp?ID=108&type=drill` }],
  build(ctx: BuildContext) {
    const Z = line("Z", "offense", 1, Math.min(Math.max(ctx.playerCount, 1), 30), 46, 92, -2.6, 0, "Dribble line", 94);
    return {
      ...base(ctx),
      id: "lib-zig-zag-dribble",
      title: "Full-Court Zig-Zag Dribble",
      kind: "drill",
      summary: "Players dribble the length of the floor in a zig-zag, changing hands at every turn, and finish with a layup.",
      objectives: ["Change direction with a low, protected crossover", "Keep eyes up while dribbling", "Finish at speed with the correct hand"],
      court: "full",
      equipment: ["1 ball per player", "Optional: cones at each turn"],
      setup: ["One line in the far corner. Players go one at a time, starting when the player ahead reaches the first turn."],
      instructions: [
        "Dribble diagonally toward the opposite sideline with the outside hand.",
        "At each turn, plant the outside foot and cross the ball to the other hand.",
        "Repeat to the far end and finish with a layup.",
        "Rebound your own shot and dribble back down the sideline.",
      ],
      rotations: ["Continuous: next player leaves when the player ahead makes the first turn."],
      coachingCues: ["Ball below the knee on the cross", "Eyes up, see the rim", "Plant and push off", "Outside hand on the turn"],
      variations: ["Between-the-legs or behind-the-back at each turn", "Add a passive defender who shadows the dribbler", "Race against the clock"],
      players: Z,
      ballStart: "Z1",
      steps: [
        step("First lane", "Outside hand, ball low, eyes up.", 1.6, [move("dribble", "Z1", 10, 79, 0, 1.6)]),
        step("Crossover", "Plant the outside foot, cross low.", 1.6, [move("dribble", "Z1", 40, 65, 0, 1.6)]),
        step("Crossover", "Change speed out of the turn.", 1.6, [move("dribble", "Z1", 10, 50, 0, 1.6)]),
        step("Crossover", "Keep the dribble on the hip.", 1.6, [move("dribble", "Z1", 40, 35, 0, 1.6)]),
        step("Attack", "Straight line to the rim.", 1.6, [move("dribble", "Z1", 30, 9, 0, 1.6, { via: [38, 18] })]),
        step("Finish", "Right-hand layup off the left foot.", 1.2, [shot("Z1", "Z1", 0, 1)]),
      ],
    };
  },
};

export const chaseDownLayup: LibraryEntry = {
  key: "chase-down-layup",
  category: "ball-handling",
  tags: ["dribble", "speed", "layup", "finish", "pressure", "1v1", "chase", "competitive", "transition"],
  ages: [9, 18],
  minPlayers: 2,
  defaultPlayers: 8,
  references: [{ title: "1v1 speed dribble (Breakthrough Basketball)", url: `${BT}/drills/1on1speeddribble` }],
  build(ctx: BuildContext) {
    const [no, nd] = split(Math.max(ctx.playerCount, 2), 2);
    const O = line("O", "offense", 1, no, 32, 40, 2.6, 0, "Offense line");
    const D = line("X", "defense", 1, nd, 18, 46, -2.6, 0, "Chaser line");
    return {
      ...base(ctx),
      id: "lib-chase-down-layup",
      title: "Chase-Down Speed Layup",
      kind: "drill",
      summary: "A ball handler with a head start sprints to the rim while a chaser tries to catch up and contest.",
      objectives: ["Push the ball ahead at full speed", "Protect the ball from a trailing defender", "Finish through contact"],
      court: "half",
      equipment: ["1 ball per pair"],
      setup: [`Offense line (${no}) at the right side of half court with balls. Chaser line (${nd}) on the left, a step behind.`],
      instructions: [
        "The ball handler pushes ahead with no more than 3-4 dribbles to the rim.",
        "The chaser leaves on the first dribble and sprints to contest without fouling.",
        "Play it out: score or stop, then the chaser outlets back to the next ball handler.",
      ],
      rotations: ["Offense to the chaser line, chaser to the offense line."],
      coachingCues: ["Push the ball out in front", "Finish high off the glass", "Chaser: sprint, don't reach", "Use your body to shield"],
      variations: ["Give the chaser a bigger head start", "Ball handler must use the weak hand"],
      players: [...O, ...D],
      ballStart: "O1",
      steps: [
        step("Push", "Ball out in front, long dribbles.", 1.8, [
          move("dribble", "O1", 28, 9, 0, 1.7, { via: [32, 22] }),
          move("cut", "X1", 25, 10, 0.3, 1.5, { via: [20, 26] }),
        ]),
        step("Finish", "Shield the ball from the chaser.", 1.2, [shot("O1", "X1", 0, 1)]),
        step("Rotate", "Chaser outlets to the next ball handler.", 2, [
          ...(O[1] ? [pass("X1", "O2", 0, 0.8)] : []),
          move("move", "O1", 18, 46, 0.2, 1.6),
          move(O[1] ? "move" : "dribble", "X1", 46, 40, 0.9, 1.1),
        ]),
      ],
    };
  },
};

export const jumpStopPivot: LibraryEntry = {
  key: "jump-stop-pivot",
  category: "footwork",
  tags: ["footwork", "jump", "stop", "pivot", "pivoting", "travel", "balance", "beginner", "youth", "fundamental"],
  ages: [7, 12],
  minPlayers: 2,
  defaultPlayers: 9,
  references: [{ title: "Jump stops & pivots drill (Breakthrough Basketball)", url: `${BT}/drills/jumpstops` }],
  build(ctx: BuildContext) {
    const [a, b, c] = split(Math.max(ctx.playerCount, 3), 3);
    const L = line("L", "offense", 1, a, 12, 38, 0, 2.6, "Left line");
    const M = line("M", "offense", 1, b, 25, 38, 0, 2.6, "Middle line");
    const R = line("R", "offense", 1, c, 38, 38, 0, 2.6, "Right line");
    return {
      ...base(ctx),
      id: "lib-jump-stop-pivot",
      title: "Jump Stop & Pivot Lines",
      kind: "drill",
      summary: "Players dribble, land in a balanced two-foot jump stop, pivot to face the line and pass to the next player.",
      objectives: ["Stop without traveling", "Pivot on a fixed foot with the ball protected", "Pass on balance after the stop"],
      court: "half",
      equipment: ["1 ball per line"],
      setup: [`Three lines at half court (${a}/${b}/${c}). First player in each line has a ball.`],
      instructions: [
        "Dribble toward the basket and land in a two-foot jump stop at the free-throw line extended.",
        "Hold the stop, then front pivot (or reverse pivot) to face your line.",
        "Pass to the next player and jog to the back of the line.",
      ],
      rotations: ["Continuous; switch from front pivots to reverse pivots after two rounds."],
      coachingCues: ["Land on both feet at once", "Sit low, chin the ball", "Pick a pivot foot and keep it", "Step to the pass"],
      variations: ["Coach calls 'front' or 'reverse' as the player lands", "Add a defender who swipes at the ball after the stop"],
      players: [...L, ...M, ...R],
      ballStart: "M1",
      steps: [
        step("Dribble in", "Controlled speed into the stop.", 1.4, [move("dribble", "M1", 25, 22, 0, 1.3)]),
        step("Jump stop", "Both feet land together, knees bent.", 0.8, [move("move", "M1", 25, 21.5, 0, 0.4)]),
        step("Pivot", "Front pivot to face the line.", 1, [move("move", "M1", 25.8, 21.4, 0, 0.8, { via: [26.5, 22.5] })]),
        step("Pass back", "Step through the pass to the next player.", 1.6, [
          ...(M[1] ? [pass("M1", "M2", 0, 0.8)] : []),
          move(M[1] ? "move" : "dribble", "M1", 27, 38, 0.8, 0.8),
        ]),
      ],
    };
  },
};

export const tripleThreatJab: LibraryEntry = {
  key: "triple-threat-jab",
  category: "footwork",
  tags: ["triple", "threat", "jab", "rip", "drive", "1v1", "footwork", "catch", "attack", "wing"],
  ages: [10, 18],
  minPlayers: 3,
  defaultPlayers: 7,
  references: [{ title: "Footwork & passing progressions (Breakthrough Basketball)", url: `${BT}/play.asp?id=75` }],
  build(ctx: BuildContext) {
    const W = line("W", "offense", 1, Math.min(Math.max(ctx.playerCount - 2, 1), 10), 45, 25, 0, 2.2, "Wing line");
    return {
      ...base(ctx),
      id: "lib-triple-threat-jab",
      title: "Triple-Threat Jab & Drive",
      kind: "drill",
      summary: "Catch on the wing in triple threat, sell a jab step, then rip through and drive past a defender.",
      objectives: ["Catch ready to shoot, pass or drive", "Use a jab to move the defender", "Rip the ball low and attack the rim"],
      court: "half",
      equipment: ["1 ball", "Coach or passer at the top"],
      setup: ["Wing line on the right. Coach at the top with the ball. One defender starts on the first wing player."],
      instructions: [
        "Wing V-cuts and catches in triple threat facing the rim.",
        "Jab at the defender's lead foot, then return to triple threat.",
        "Rip the ball across low and drive baseline for a layup.",
        "Defender rebounds and passes back to the coach.",
      ],
      rotations: ["Offense becomes the defender; defender goes to the back of the wing line."],
      coachingCues: ["Catch with the ball on your hip", "Short, quick jab", "Rip low, not high", "First step past the defender's hip"],
      variations: ["Jab and shoot if the defender drops", "Jab, crossover and drive middle"],
      players: [P("C", "C", "coach", 25, 30, "Passer"), P("X", "X", "defense", 37, 17, "Defender"), ...W],
      ballStart: "C",
      steps: [
        step("Get open", "V-cut, then show a target hand.", 2.2, [
          move("cut", "W1", 39, 12, 0, 0.9),
          move("cut", "W1", 41, 21, 0.9, 0.7),
          pass("C", "W1", 1.4, 0.7),
          move("move", "X", 38, 18.5, 0.9, 0.9),
        ]),
        step("Jab", "Quick jab at the lead foot, then back.", 1.2, [
          move("move", "W1", 39.6, 19.6, 0, 0.4),
          move("move", "W1", 41, 21, 0.5, 0.4),
          move("move", "X", 37.5, 18, 0.2, 0.5),
        ]),
        step("Rip & drive", "Rip low and go baseline.", 1.6, [
          move("dribble", "W1", 31, 6, 0, 1.4, { via: [42, 11] }),
          move("move", "X", 33, 9, 0.2, 1.2),
        ]),
        step("Finish & reset", "Defender rebounds and returns the ball.", 2, [shot("W1", "X", 0, 1), pass("X", "C", 1.1, 0.8)]),
      ],
    };
  },
};

export const mikanDrill: LibraryEntry = {
  key: "mikan-drill",
  category: "finishing",
  tags: ["mikan", "layup", "finish", "finishing", "footwork", "touch", "post", "big", "rim", "hands", "conditioning"],
  ages: [8, 18],
  minPlayers: 1,
  defaultPlayers: 6,
  references: [{ title: "Mikan drill (Breakthrough Basketball)", url: `${BT}/drills/Mikan-Drill` }],
  build(ctx: BuildContext) {
    const Q = line("M", "offense", 2, Math.min(Math.max(ctx.playerCount - 1, 0), 11), 47, 6, 0, 3.4, "Next up");
    return {
      ...base(ctx),
      id: "lib-mikan-drill",
      title: "Mikan Drill",
      kind: "drill",
      summary: "Continuous alternating layups under the rim to build touch, footwork and soft hands.",
      objectives: ["Finish with either hand", "Catch the ball high without bringing it down", "Rhythm footwork off one foot"],
      court: "half",
      equipment: ["1 ball per player at the basket"],
      setup: ["One player under the basket; others wait along the right sideline. 30-second turns."],
      instructions: [
        "Start on the right side just in front of the rim and shoot a right-hand layup off the left foot.",
        "Catch the ball out of the net with hands high and step across to the left side.",
        "Shoot a left-hand layup off the right foot. Keep alternating without dribbling.",
        "Count makes in 30 seconds.",
      ],
      rotations: ["Rotate every 30 seconds; the next player steps in as the shooter leaves."],
      coachingCues: ["Ball stays above the shoulders", "Use the backboard", "Opposite foot, opposite hand", "Quick feet, soft hands"],
      variations: ["Reverse Mikan (finishing from the other side of the rim)", "Use a jump stop and two-foot finish", "Pivot and power finish"],
      players: [P("M1", "M1", "offense", 27.5, 6.5, "Shooter"), ...Q],
      ballStart: "M1",
      steps: [
        step("Right hand", "Right-hand layup off the left foot.", 1, [shot("M1", "M1", 0, 0.9)]),
        step("Step across", "Catch high, step to the left side.", 0.8, [move("move", "M1", 22.5, 6.5, 0, 0.7)]),
        step("Left hand", "Left-hand layup off the right foot.", 1, [shot("M1", "M1", 0, 0.9)]),
        step("Step across", "Stay under the rim.", 0.8, [move("move", "M1", 27.5, 6.5, 0, 0.7)]),
        step("Right hand", "Keep the rhythm.", 1, [shot("M1", "M1", 0, 0.9)]),
      ],
    };
  },
};

export const twoLineLayups: LibraryEntry = {
  key: "two-line-layups",
  category: "finishing",
  tags: ["layup", "layups", "finish", "warmup", "rebound", "pass", "beginner", "youth", "two", "lines"],
  ages: [7, 18],
  minPlayers: 4,
  defaultPlayers: 10,
  references: [{ title: "Youth basketball drills index (Breakthrough Basketball)", url: `${BT}/drills/kids-youth` }],
  build(ctx: BuildContext) {
    const [nl, nr] = split(Math.max(ctx.playerCount, 4), 2);
    const L = line("L", "offense", 1, nl, 40, 28, 1, 2.5, "Layup line");
    const R = line("R", "offense", 1, nr, 10, 28, -1, 2.5, "Rebound line");
    return {
      ...base(ctx),
      id: "lib-two-line-layups",
      title: "Two-Line Layups",
      kind: "warmup",
      summary: "Classic layup lines: one line drives for a right-hand layup, the other rebounds and feeds the next shooter.",
      objectives: ["Right-hand layup off the left foot", "Rebound before the ball hits the floor", "Accurate outlet pass to the next shooter"],
      court: "half",
      equipment: ["3-4 balls in the layup line"],
      setup: [`Layup line (${nl}) at the right elbow extended with balls. Rebound line (${nr}) at the left elbow extended.`],
      instructions: [
        "Layup line dribbles in and shoots a right-hand layup.",
        "Rebound line cuts in, rebounds and passes to the next player in the layup line.",
        "Players switch lines after each turn.",
      ],
      rotations: ["Shooter goes to the rebound line, rebounder goes to the layup line. Switch to the left side after 3 minutes."],
      coachingCues: ["Left foot, right hand", "High off the square", "Rebounder: two hands, chin it", "Call the shooter's name on the pass"],
      variations: ["Left-hand layups from the left side", "Power layups off two feet", "Reverse layups"],
      players: [...L, ...R],
      ballStart: "L1",
      steps: [
        step("Drive", "Attack at an angle; eyes on the square.", 1.6, [
          move("dribble", "L1", 31, 9, 0, 1.4, { via: [36, 17] }),
          move("cut", "R1", 22, 7, 0.6, 1),
        ]),
        step("Layup", "Right hand, high off the glass.", 1.2, [shot("L1", "R1", 0, 1)]),
        step("Outlet & switch", "Pass to the next shooter; switch lines.", 2.2, [
          ...(L[1] ? [pass("R1", "L2", 0.1, 0.9)] : []),
          move("move", "R1", L[L.length - 1].x + 1, Math.min(L[L.length - 1].y + 2.5, 46), 1, 1.2),
          move("move", "L1", R[R.length - 1].x - 1, Math.min(R[R.length - 1].y + 2.5, 46), 0.3, 1.6),
        ]),
      ],
    };
  },
};

export const dropStepPower: LibraryEntry = {
  key: "drop-step-power",
  category: "finishing",
  tags: ["post", "drop", "step", "power", "layup", "big", "low", "entry", "pass", "seal", "finish"],
  ages: [10, 18],
  minPlayers: 2,
  defaultPlayers: 8,
  references: [{ title: "Youth basketball drills index (Breakthrough Basketball)", url: `${BT}/drills/kids-youth` }],
  build(ctx: BuildContext) {
    const [np, nw] = split(Math.max(ctx.playerCount, 2), 2);
    const Po = line("P", "offense", 1, np, 12, 3, -2.4, 0, "Post line");
    const Wi = line("W", "offense", 1, nw, 6, 21, -1, 2.5, "Wing passers");
    return {
      ...base(ctx),
      id: "lib-drop-step-power",
      title: "Post Seal & Drop-Step Power Finish",
      kind: "drill",
      summary: "Post players seal on the block, catch an entry pass and finish with a drop step and two-foot power layup.",
      objectives: ["Seal with a wide base and target hand", "Drop step toward the baseline", "Finish strong off two feet"],
      court: "half",
      equipment: ["1-2 balls with the wing passers"],
      setup: [`Post line (${np}) on the left baseline. Wing passers (${nw}) at the left wing with the ball.`],
      instructions: [
        "Post player steps to the block and seals, showing a target hand.",
        "Wing makes a bounce-pass entry.",
        "Post player catches, chins the ball, drop-steps to the baseline and power-finishes off two feet.",
        "Post outlets to the next wing; players switch lines.",
      ],
      rotations: ["Post goes to the wing line; passer goes to the post line."],
      coachingCues: ["Sit low, wide base", "Target hand away from the defender", "Chin it before you move", "Two feet, go up strong"],
      variations: ["Add a passive defender behind the post", "Middle drop step to a jump hook"],
      players: [...Po, ...Wi],
      ballStart: "W1",
      steps: [
        step("Seal", "Wide base on the block; show a target.", 1.2, [move("cut", "P1", 17.5, 8, 0, 1)]),
        step("Entry", "Bounce pass away from the defender.", 1, [pass("W1", "P1", 0.1, 0.7)]),
        step("Drop step", "Step to the baseline and finish off two feet.", 1.8, [
          move("move", "P1", 21, 5, 0, 0.6),
          shot("P1", "P1", 0.7, 0.9),
        ]),
        step("Switch lines", "Outlet to the next wing.", 2.2, [
          ...(Wi[1] ? [pass("P1", "W2", 0, 0.9)] : []),
          move(Wi[1] ? "move" : "dribble", "P1", 3, 26, 0.9, 1.2),
          move("move", "W1", 3, 3, 0.2, 1.4),
        ]),
      ],
    };
  },
};

export const SKILLS: LibraryEntry[] = [zigZagDribble, chaseDownLayup, jumpStopPivot, tripleThreatJab, mikanDrill, twoLineLayups, dropStepPower];
