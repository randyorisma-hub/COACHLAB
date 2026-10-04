/** Passing and shooting drills. */
import type { Player } from "../schema";
import { bench, base, line, move, P, pass, shot, split, step, type BuildContext, type LibraryEntry } from "./dsl";

const BT = "https://www.breakthroughbasketball.com";

export const monkeyInMiddle: LibraryEntry = {
  key: "monkey-in-the-middle",
  category: "passing",
  tags: ["pass", "passing", "pivot", "fake", "bounce", "overhead", "pressure", "defender", "beginner", "youth", "triangle", "3"],
  ages: [7, 14],
  minPlayers: 3,
  defaultPlayers: 9,
  references: [{ title: "Monkey in the middle passing (Breakthrough Basketball)", url: `${BT}/drills/bigelow-2-passing-drills` }],
  build(ctx: BuildContext) {
    const groups = Math.max(1, Math.min(Math.floor(ctx.playerCount / 3), 4));
    const players: Player[] = [];
    for (let g = 0; g < groups; g++) {
      const y = 8 + g * (36 / Math.max(groups - 1, 1));
      const n = g + 1;
      players.push(P(`A${n}`, `A${n}`, "offense", 12, y, `Group ${n} passer`));
      players.push(P(`M${n}`, `M${n}`, "defense", 25, y, `Group ${n} middle`));
      players.push(P(`B${n}`, `B${n}`, "offense", 38, y, `Group ${n} passer`));
    }
    const y1 = players[0].y;
    return {
      ...base(ctx),
      id: "lib-monkey-in-the-middle",
      title: "Monkey in the Middle Passing",
      kind: "drill",
      summary: "Two passers try to complete passes past a pressuring defender using pivots, fakes and bounce or overhead passes.",
      objectives: ["Pivot away from pressure", "Fake a pass to move the defender", "Choose bounce or overhead passes to beat hands"],
      court: "half",
      equipment: ["1 ball per group of 3"],
      setup: [`${groups} group(s) of three, passers about 12-15 feet apart with a defender between them.`],
      instructions: [
        "The defender closes out on the ball and stays active with hands.",
        "The passer pivots and fakes, then passes past the defender (no lob over their head).",
        "The defender sprints to pressure the new ball. A deflection swaps the defender with the passer.",
      ],
      rotations: ["Rotate the middle every 30 seconds or on a deflection."],
      coachingCues: ["Pivot, don't turn your back", "Fake a pass to make a pass", "Pass by the defender's ear or hip", "Receiver: step to the ball"],
      variations: ["Receivers must move to get open", "Only bounce passes", "Two defenders against three passers"],
      players,
      ballStart: "A1",
      steps: [
        step("Pressure", "Defender closes out with active hands.", 1.2, [move("move", "M1", 15.5, y1, 0, 1)]),
        step("Pivot & fake", "Fake high, pivot low.", 1, [move("move", "A1", 12.4, y1 + 1, 0, 0.5), move("move", "M1", 15.5, y1 - 0.6, 0.3, 0.4)]),
        step("Bounce pass", "Pass by the defender's hip.", 1.4, [
          pass("A1", "B1", 0, 0.8),
          move("move", "M1", 34.5, y1, 0.3, 1.1),
        ]),
        step("Pressure the new ball", "Defender sprints and closes out.", 1.2, [move("move", "B1", 38.6, y1 - 1, 0, 0.6)]),
        step("Overhead pass", "Ball fake low, pass high past the ear.", 1.2, [pass("B1", "A1", 0, 0.8), move("move", "M1", 25, y1, 0.3, 0.9)]),
      ],
    };
  },
};

export const trianglePassing: LibraryEntry = {
  key: "triangle-pass-and-follow",
  category: "passing",
  tags: ["pass", "passing", "follow", "triangle", "catch", "warmup", "beginner", "youth", "lines", "conditioning"],
  ages: [7, 14],
  minPlayers: 3,
  defaultPlayers: 12,
  references: [{ title: "Youth basketball drills index (Breakthrough Basketball)", url: `${BT}/drills/kids-youth` }],
  build(ctx: BuildContext) {
    const [nt, nr, nl] = split(Math.max(ctx.playerCount, 3), 3);
    const T = line("T", "offense", 1, nt, 25, 34, 0, 2.5, "Top line");
    const R = line("R", "offense", 1, nr, 42, 20, 2, 0, "Right line");
    const L = line("L", "offense", 1, nl, 8, 20, -2, 0, "Left line");
    return {
      ...base(ctx),
      id: "lib-triangle-pass-and-follow",
      title: "Triangle Pass & Follow",
      kind: "warmup",
      summary: "Three lines in a triangle. Pass to the next line and follow your pass to the back of that line.",
      objectives: ["Crisp chest passes to a target hand", "Step to the ball on the catch", "Keep moving after every pass"],
      court: "half",
      equipment: ["1-2 balls"],
      setup: [`Three lines in a triangle: top (${nt}), right wing (${nr}), left wing (${nl}). The top line starts with the ball.`],
      instructions: [
        "Top passes to the right wing and runs to the back of the right line.",
        "Right wing passes to the left wing and follows to the left line.",
        "Left wing passes to the top and follows. Keep it going.",
      ],
      rotations: ["Continuous; reverse direction every minute."],
      coachingCues: ["Show a target hand", "Step to meet the pass", "Pass and sprint", "Thumbs down on the follow-through"],
      variations: ["Add a second ball", "Bounce passes only", "Receiver jump-stops and pivots before passing"],
      players: [...T, ...R, ...L],
      ballStart: "T1",
      steps: [
        step("Top to right", "Pass, then follow it.", 1.8, [
          pass("T1", "R1", 0, 0.8),
          move("move", "T1", Math.min(R[R.length - 1].x + 2, 50), 22, 0.6, 1.2),
        ]),
        step("Right to left", "Step to the ball, pass across.", 2, [
          pass("R1", "L1", 0, 1),
          move("move", "R1", Math.max(L[L.length - 1].x - 2, 0), 22, 0.6, 1.4),
        ]),
        step("Left to top", "Next player at the top shows a target.", 1.8, [
          pass("L1", T[1] ? "T2" : "T1", 0, 0.9),
          move("move", "L1", 27, Math.min(T[T.length - 1].y + 2.5, 46), 0.6, 1.2),
        ]),
      ],
    };
  },
};

export const formShooting: LibraryEntry = {
  key: "form-shooting",
  category: "shooting",
  tags: ["shooting", "shot", "form", "technique", "close", "one", "hand", "beginner", "youth", "warmup", "partner"],
  ages: [7, 18],
  minPlayers: 2,
  defaultPlayers: 6,
  references: [{ title: "Form shooting drill for teams (Breakthrough Basketball)", url: `${BT}/drills/formshooting` }],
  build(ctx: BuildContext) {
    const pairs = Math.max(1, Math.min(Math.floor(ctx.playerCount / 2), 3));
    const spots = [
      { s: [25, 11], r: [28, 3] },
      { s: [19, 9], r: [15, 3] },
      { s: [31, 9], r: [35, 3] },
    ];
    const players: Player[] = [];
    for (let i = 0; i < pairs; i++) {
      players.push(P(`S${i + 1}`, `S${i + 1}`, "offense", spots[i].s[0], spots[i].s[1], `Shooter ${i + 1}`));
      players.push(P(`R${i + 1}`, `R${i + 1}`, "offense", spots[i].r[0], spots[i].r[1], `Partner ${i + 1}`));
    }
    players.push(...bench(ctx.playerCount - pairs * 2));
    return {
      ...base(ctx),
      id: "lib-form-shooting",
      title: "Partner Form Shooting",
      kind: "warmup",
      summary: "Close-range, one-hand shots with a partner rebounding, stepping back only after makes.",
      objectives: ["Balanced base and aligned elbow", "High release and follow-through", "Build a repeatable routine"],
      court: "half",
      equipment: ["1 ball per pair"],
      setup: [`${pairs} pair(s) around the rim, shooters 4-6 feet away. Extra players rotate in from half court.`],
      instructions: [
        "Shoot one-handed (guide hand off) from close range. Hold the follow-through.",
        "Partner rebounds and passes back to the shooting pocket.",
        "After 3 makes in a row, take one step back.",
        "Switch roles after 10 makes.",
      ],
      rotations: ["Shooter and partner switch after 10 makes; rotate spots every round."],
      coachingCues: ["Feet shoulder-width, toes to the rim", "Elbow under the ball", "Reach into the cookie jar", "Hold the follow-through"],
      variations: ["Add the guide hand after one round", "Close eyes on the release for feel", "Count swishes only"],
      players,
      ballStart: "S1",
      steps: [
        step("One-hand shot", "Elbow in, high release.", 1.2, [shot("S1", "R1", 0, 1)]),
        step("Return pass", "Partner passes to the shooting pocket.", 1, [pass("R1", "S1", 0, 0.7)]),
        step("Shoot again", "Same routine every time.", 1.2, [shot("S1", "R1", 0, 1)]),
        step("Step back", "Three makes in a row: one step back.", 1.6, [move("move", "S1", 25, 14, 0, 0.6), pass("R1", "S1", 0.4, 0.8)]),
        step("Longer shot", "Same form, more legs.", 1.2, [shot("S1", "R1", 0, 1)]),
      ],
    };
  },
};

export const partnerSpotShooting: LibraryEntry = {
  key: "partner-spot-shooting",
  category: "shooting",
  tags: ["shooting", "catch", "shoot", "spot", "partner", "relocate", "v-cut", "corner", "wing", "three", "jumper"],
  ages: [10, 18],
  minPlayers: 2,
  defaultPlayers: 6,
  references: [{ title: "Shooting off cuts & screens (Breakthrough Basketball)", url: `${BT}/drills/game-like-shooting` }],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-partner-spot-shooting",
      title: "Partner Catch-and-Shoot Spots",
      kind: "drill",
      summary: "Shooter gets open with a V-cut, catches ready and shoots, then relocates to a new spot while the partner rebounds.",
      objectives: ["Feet set before the catch", "Shot ready hands", "Relocate after every shot"],
      court: "half",
      equipment: ["1 ball per pair"],
      setup: ["Pairs: shooter on the right wing, partner under the basket with the ball. Extra pairs share other baskets or wait."],
      instructions: [
        "Shooter V-cuts and pops to the wing; partner passes.",
        "Shoot, then relocate to the corner, then to the top.",
        "Partner rebounds every shot and hits the shooter on the move.",
        "Switch after 10 shots.",
      ],
      rotations: ["Shooter and rebounder switch every 10 shots; pairs track makes."],
      coachingCues: ["Hands ready before the catch", "Hop into the shot", "Shoot it on the way up", "Move after you shoot"],
      variations: ["Shot fake, one dribble, pull-up", "Add a closeout defender", "Shoot from 5 spots around the arc"],
      players: [P("S", "S", "offense", 40, 25, "Shooter"), P("R", "R", "offense", 27, 7, "Rebounder"), ...bench(ctx.playerCount - 2)],
      ballStart: "R",
      steps: [
        step("V-cut", "Sell it, then pop out.", 2, [move("cut", "S", 36, 13, 0, 0.9), move("cut", "S", 40, 21, 0.9, 0.7), pass("R", "S", 1.3, 0.7)]),
        step("Wing shot", "Feet set, shoot.", 1.4, [shot("S", "R", 0, 1), move("move", "R", 27, 9, 0, 0.8)]),
        step("Relocate to corner", "Move as the shot goes up.", 1.8, [move("cut", "S", 46, 4, 0, 1.1), pass("R", "S", 1, 0.7)]),
        step("Corner shot", "Square to the rim.", 1.4, [shot("S", "R", 0, 1)]),
        step("Relocate to top", "Sprint, stop on balance.", 2, [move("cut", "S", 25, 24, 0, 1.3, { via: [38, 16] }), pass("R", "S", 1.2, 0.7)]),
        step("Top shot", "Same form from deeper.", 1.4, [shot("S", "R", 0, 1)]),
      ],
    };
  },
};

export const aroundTheWorld: LibraryEntry = {
  key: "around-the-world",
  category: "games",
  tags: ["shooting", "game", "around", "world", "fun", "spots", "competition", "youth", "beginner"],
  ages: [7, 16],
  minPlayers: 2,
  defaultPlayers: 6,
  references: [{ title: "Basketball drills and games for kids (Basketball for Coaches)", url: "https://www.basketballforcoaches.com/basketball-drills-and-games-for-kids/" }],
  build(ctx: BuildContext) {
    const spots: [number, number][] = [
      [33, 5],
      [36, 13],
      [25, 16],
      [14, 13],
      [17, 5],
    ];
    const steps = spots.flatMap(([x, y], i) => [
      step(`Spot ${i + 1}`, i === 0 ? "Make it to move on." : "Catch, set your feet, shoot.", 1.8, [
        move("move", "S1", x, y, 0, 0.8),
        pass("C", "S1", 0.8, 0.6),
      ]),
      step(`Shot ${i + 1}`, "Coach rebounds every shot.", 1.2, [shot("S1", "C", 0, 1)]),
    ]);
    return {
      ...base(ctx),
      id: "lib-around-the-world",
      title: "Around the World",
      kind: "game",
      summary: "Shooters work around five spots close to the basket and must make each shot to advance.",
      objectives: ["Make shots under light pressure", "Shoot from different angles", "Use the backboard on angle shots"],
      court: "half",
      equipment: ["1 ball per basket", "Optional spot markers"],
      setup: ["Five spots in an arc about 8-10 feet from the rim. One shooter at a time; a coach or partner rebounds."],
      instructions: [
        "Start at the right block spot. Make it to move to the next spot.",
        "Miss: choose to stay, or take a 'chance' shot — make it and move on, miss and start over.",
        "First to go all the way around and back wins.",
      ],
      rotations: ["Each player takes one turn of up to 3 misses, then passes to the next player."],
      coachingCues: ["Square your feet to the rim", "Use the glass on angles", "Same routine every shot"],
      variations: ["Move the spots out for older players", "Two shooters race at two baskets"],
      players: [P("S1", "S1", "offense", 33, 5, "Shooter"), P("C", "C", "coach", 25, 3, "Rebounder"), ...line("S", "neutral", 2, Math.max(ctx.playerCount - 1, 0), 4, 40, 4, 0, "Waiting")],
      ballStart: "C",
      steps,
    };
  },
};

export const elbowPullUp: LibraryEntry = {
  key: "elbow-pull-up",
  category: "shooting",
  tags: ["pull-up", "pullup", "jumper", "one", "dribble", "elbow", "mid-range", "shooting", "attack", "catch"],
  ages: [12, 18],
  minPlayers: 3,
  defaultPlayers: 7,
  references: [{ title: "6 basic form shooting drills (Breakthrough Basketball)", url: `${BT}/fundamentals/shooting-drills` }],
  build(ctx: BuildContext) {
    const W = line("W", "offense", 1, Math.min(Math.max(ctx.playerCount - 2, 1), 10), 45, 25, 0, 2.2, "Wing line");
    return {
      ...base(ctx),
      id: "lib-elbow-pull-up",
      title: "One-Dribble Elbow Pull-Up",
      kind: "drill",
      summary: "Catch on the wing, attack with one hard dribble to the elbow and rise into a balanced pull-up jumper.",
      objectives: ["Gather into a two-foot stop", "Rise straight up with no drift", "Shoot off the dribble on rhythm"],
      court: "half",
      equipment: ["2 balls"],
      setup: ["Wing line on the right. Coach at the top with a ball. Rebounder under the basket."],
      instructions: [
        "Wing V-cuts and catches from the coach.",
        "One hard dribble toward the elbow, hop into a two-foot stop and shoot.",
        "Rebounder passes back to the coach. Shooter becomes the next rebounder.",
      ],
      rotations: ["Shooter → rebounder → back of the wing line."],
      coachingCues: ["Rip and go", "One big dribble", "Hop to a stop, shoulders square", "Straight up, straight down"],
      variations: ["Go left to the other elbow", "Add a shot fake before the dribble", "Live defender from the top"],
      players: [P("C", "C", "coach", 25, 30, "Passer"), P("R", "R", "offense", 27, 6, "Rebounder"), ...W],
      ballStart: "C",
      steps: [
        step("Catch", "V-cut and catch on balance.", 2, [move("cut", "W1", 39, 13, 0, 0.9), move("cut", "W1", 41, 22, 0.9, 0.7), pass("C", "W1", 1.3, 0.7)]),
        step("One dribble", "Rip and push hard to the elbow.", 1, [move("dribble", "W1", 32, 18.5, 0, 0.8)]),
        step("Pull-up", "Hop, square up, rise.", 1.3, [shot("W1", "R", 0.1, 1)]),
        step("Reset", "Rebounder returns the ball to the coach.", 1.6, [pass("R", "C", 0, 0.9), move("move", "W1", 27, 5, 0.3, 1.2)]),
      ],
    };
  },
};

export const PASSING_SHOOTING: LibraryEntry[] = [monkeyInMiddle, trianglePassing, formShooting, partnerSpotShooting, aroundTheWorld, elbowPullUp];
