/** Team offense, set plays, inbounds plays, press break and small-sided games. */
import { bench, base, move, P, pass, shot, step, type BuildContext, type LibraryEntry } from "./dsl";

const BT = "https://www.breakthroughbasketball.com";

export const hornsPickAndPop: LibraryEntry = {
  key: "horns-pick-and-pop",
  category: "team-offense",
  tags: ["horns", "set", "play", "pick", "pop", "roll", "screen", "ball", "screen", "elbows", "offense", "5"],
  ages: [12, 18],
  minPlayers: 5,
  defaultPlayers: 10,
  references: [
    { title: "Horns offense (Coach's Clipboard)", url: "https://www.coachesclipboard.net/HornsOffense.html" },
    { title: "Horns offense guide (The Hoops Geek)", url: "https://www.thehoopsgeek.com/basketball-horns-offense/" },
  ],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-horns-pick-and-pop",
      title: "Horns: Pick-and-Roll / Pick-and-Pop",
      kind: "play",
      summary: "From the Horns alignment, one big screens and rolls while the other pops to the top for a shot or a high-low pass.",
      objectives: ["Read the screen and attack", "Screener rolls hard; second big pops", "Make the simple read: roll, pop or kick"],
      court: "half",
      equipment: ["1 ball"],
      setup: ["1 at the top with the ball, 4 and 5 at the elbows, 2 and 3 in the corners."],
      instructions: [
        "5 steps up and sets a ball screen on 1's right side.",
        "1 dribbles off the screen toward the right wing; 5 rolls to the rim.",
        "4 pops out to the top of the key.",
        "1 reads: hit 5 on the roll, 4 on the pop, or the corner if a defender helps.",
      ],
      rotations: ["Run it 5-on-0, then 5-on-5 at half speed, then live. Rotate units every 3 reps."],
      coachingCues: ["Wait for the screen", "Shoulder to shoulder", "Roll with your hands up", "Pop with your feet set"],
      variations: ["Screen on the left with 4", "Both bigs screen (double drag)", "1 rejects the screen and drives the other way"],
      players: [
        P("O1", "1", "offense", 25, 30, "Point guard"),
        P("O2", "2", "offense", 47, 3, "Right corner"),
        P("O3", "3", "offense", 3, 3, "Left corner"),
        P("O4", "4", "offense", 19, 19.5, "Left elbow"),
        P("O5", "5", "offense", 31, 19.5, "Right elbow"),
        ...bench(ctx.playerCount - 5),
      ],
      ballStart: "O1",
      steps: [
        step("Ball screen", "5 sprints up and stops on 1's right hip.", 1.4, [move("screen", "O5", 28, 27.5, 0, 1.1, { targetId: "O1" })]),
        step("Use it", "1 comes off tight; 5 rolls; 4 pops.", 2.2, [
          move("dribble", "O1", 36, 22, 0, 1.3, { via: [31, 30] }),
          move("cut", "O5", 27, 9, 0.6, 1.3),
          move("cut", "O4", 24, 28, 0.6, 1.3),
        ]),
        step("Pop pass", "Help on the roll: 4 is open on the pop.", 1, [pass("O1", "O4", 0, 0.8)]),
        step("Shot", "Feet set; 5 seals for the rebound.", 1.2, [shot("O4", "O5", 0, 1)]),
      ],
    };
  },
};

export const highBackdoor: LibraryEntry = {
  key: "one-four-high-backdoor",
  category: "team-offense",
  tags: ["1-4", "high", "set", "play", "backdoor", "high", "post", "entry", "denial", "pressure", "cut", "bounce"],
  ages: [11, 18],
  minPlayers: 5,
  defaultPlayers: 10,
  references: [{ title: "Basketball plays (Coach's Clipboard)", url: "https://www.coachesclipboard.net/BasketballPlays.html" }],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-one-four-high-backdoor",
      title: "1-4 High: Post Entry Backdoor",
      kind: "play",
      summary: "Against a denying defense, the ball goes to the high post and the wing on that side cuts backdoor for a bounce pass.",
      objectives: ["Punish overplay with a backdoor cut", "Make a strong high-post entry", "Deliver a bounce pass to the cutter"],
      court: "half",
      equipment: ["1 ball"],
      setup: ["1 at the top. 4 and 5 at the elbows. 2 and 3 on the wings at free-throw-line extended."],
      instructions: [
        "5 flashes out to the free-throw line and catches from 1.",
        "As 5 catches, 2 (same side) plants and cuts backdoor to the rim.",
        "5 pivots and bounce-passes to 2 for the layup.",
        "1 cuts away to keep the help defender busy; 4 drops to the block for the rebound.",
      ],
      rotations: ["Run both sides; rotate units every 3 reps."],
      coachingCues: ["Catch and face the rim", "Wing: plant hard, then go", "Bounce pass past the defender", "Everyone moves on the entry"],
      variations: ["If 2 isn't open, 5 dribble hand-offs to 2", "4 and 5 high-low if the defense fronts"],
      players: [
        P("O1", "1", "offense", 25, 32, "Point guard"),
        P("O2", "2", "offense", 42, 20, "Right wing"),
        P("O3", "3", "offense", 8, 20, "Left wing"),
        P("O4", "4", "offense", 19, 19, "Left elbow"),
        P("O5", "5", "offense", 31, 19, "Right elbow"),
        ...bench(ctx.playerCount - 5),
      ],
      ballStart: "O1",
      steps: [
        step("High-post entry", "5 flashes to the ball and catches.", 1.6, [
          move("cut", "O5", 28, 22, 0, 0.6),
          pass("O1", "O5", 0.6, 0.8),
          move("cut", "O2", 42, 23, 0, 0.8),
        ]),
        step("Backdoor", "2 plants and cuts as 5 faces up.", 2, [
          move("move", "O5", 28.3, 21.6, 0, 0.4),
          move("cut", "O2", 30, 6, 0.3, 1.2, { via: [40, 12] }),
          move("cut", "O1", 12, 26, 0.3, 1.2),
          move("cut", "O4", 18.5, 8, 0.5, 1.1),
          pass("O5", "O2", 1, 0.6),
        ]),
        step("Layup", "Finish; 4 rebounds.", 1.2, [shot("O2", "O4", 0, 1)]),
      ],
    };
  },
};

export const driveAndKick: LibraryEntry = {
  key: "drive-and-kick",
  category: "team-offense",
  tags: ["drive", "kick", "spacing", "4-out", "motion", "corner", "three", "help", "penetrate", "drift", "offense"],
  ages: [10, 18],
  minPlayers: 5,
  defaultPlayers: 10,
  references: [{ title: "Youth offense drills (Breakthrough Basketball)", url: `${BT}/drills/kids-youth` }],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-drive-and-kick",
      title: "4-Out 1-In Drive & Kick",
      kind: "play",
      summary: "Spacing rules for penetration: the driver draws help and kicks to the open shooter while teammates drift and lift into passing lanes.",
      objectives: ["Drive to draw two defenders", "Drift and lift to stay in the driver's sight line", "Catch and shoot or attack the closeout"],
      court: "half",
      equipment: ["1 ball"],
      setup: ["1 at the top, 2 and 3 on the wings, 4 in the right corner, 5 on the left block."],
      instructions: [
        "1 drives right toward the elbow.",
        "2 drifts behind the drive to the slot; 3 lifts to the top; 5 slides to the dunker spot.",
        "When the corner defender helps, 1 kicks to 4 for the shot.",
      ],
      rotations: ["Play 5-on-0, then 5-on-5 with defenders told to help. Rotate positions every rep."],
      coachingCues: ["Drive to score, not to pass", "Drift behind, lift above", "Hands ready in the corner", "Shoot it or drive the closeout"],
      variations: ["Kick-out must be followed by a second drive", "Score only off a kick-out pass"],
      players: [
        P("O1", "1", "offense", 25, 28, "Point guard"),
        P("O2", "2", "offense", 41, 20, "Right wing"),
        P("O3", "3", "offense", 9, 20, "Left wing"),
        P("O4", "4", "offense", 47, 4, "Right corner"),
        P("O5", "5", "offense", 18, 7, "Post"),
        ...bench(ctx.playerCount - 5),
      ],
      ballStart: "O1",
      steps: [
        step("Drive", "Attack the gap between defenders.", 1.8, [
          move("dribble", "O1", 32, 13, 0, 1.4),
          move("cut", "O2", 38, 27, 0.4, 1.1),
          move("cut", "O3", 18, 28, 0.4, 1.2),
          move("move", "O5", 20, 4, 0.4, 0.9),
        ]),
        step("Kick", "Corner help means the corner is open.", 1, [pass("O1", "O4", 0, 0.8)]),
        step("Shot", "Catch and shoot; 5 crashes.", 1.4, [shot("O4", "O5", 0, 1), move("cut", "O5", 23, 6, 0.2, 0.8)]),
      ],
    };
  },
};

export const boxBlob: LibraryEntry = {
  key: "box-blob-screen-the-screener",
  category: "special-situations",
  tags: ["inbounds", "inbound", "baseline", "out", "of", "bounds", "blob", "box", "screen", "screener", "set", "play"],
  ages: [11, 18],
  minPlayers: 5,
  defaultPlayers: 10,
  references: [
    { title: "6 baseline out of bounds plays from the box set (Breakthrough Basketball)", url: `${BT}/plays/baseline-box-plays` },
    { title: "5 simple basketball inbound plays (Basketball for Coaches)", url: "https://www.basketballforcoaches.com/basketball-inbound-plays/" },
  ],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-box-blob-screen-the-screener",
      title: "Box BLOB: Screen the Screener",
      kind: "play",
      summary: "Baseline inbounds from a box: a down screen gets a safety outlet, then the screener receives a screen and cuts to the rim.",
      objectives: ["Screen angles in a crowded area", "Read the defense switching screens", "Always have a safety outlet"],
      court: "half",
      equipment: ["1 ball"],
      setup: ["1 inbounds from the right of the basket. 5 on the ball-side block, 4 on the weak-side block, 2 at the ball-side elbow, 3 at the weak-side elbow."],
      instructions: [
        "3 sets a down screen for 4; 4 pops to the top as the safety.",
        "5 screens the screener (3), who cuts to the rim.",
        "2 pops to the ball-side corner as a shooter.",
        "1 reads: 3 at the rim, 2 in the corner, or 4 at the top.",
      ],
      rotations: ["Rotate the inbounder every rep; run against live defense after 3 dry runs."],
      coachingCues: ["Inbounder: slap the ball to start", "Set screens, then roll to the ball", "Sell the cut", "Safety stays outside the arc"],
      variations: ["2 curls to the rim instead of popping", "Against a zone, 3 seals the middle defender"],
      players: [
        P("O1", "1", "offense", 34, 0.5, "Inbounder"),
        P("O5", "5", "offense", 31.5, 7, "Ball-side block"),
        P("O4", "4", "offense", 18.5, 7, "Weak-side block"),
        P("O2", "2", "offense", 31, 19, "Ball-side elbow"),
        P("O3", "3", "offense", 19, 19, "Weak-side elbow"),
        ...bench(ctx.playerCount - 5),
      ],
      ballStart: "O1",
      steps: [
        step("Down screen", "3 screens down for 4; 4 pops to the top.", 1.6, [
          move("screen", "O3", 19.5, 10, 0, 1, { targetId: "O4" }),
          move("cut", "O4", 25, 25, 0.8, 0.8, { via: [16, 17] }),
          move("cut", "O2", 45, 5, 0.3, 1.2),
        ]),
        step("Screen the screener", "5 screens for 3, who cuts to the rim.", 1.6, [
          move("screen", "O5", 23, 10, 0, 0.9, { targetId: "O3" }),
          move("cut", "O3", 28, 5.5, 0.8, 0.7),
        ]),
        step("Inbound", "3 is open at the rim.", 1, [pass("O1", "O3", 0, 0.6)]),
        step("Score", "Finish; 5 crashes.", 1.2, [shot("O3", "O5", 0, 1)]),
      ],
    };
  },
};

export const sidelineStack: LibraryEntry = {
  key: "sideline-stack-entry",
  category: "special-situations",
  tags: ["inbounds", "inbound", "sideline", "slob", "out", "of", "bounds", "stack", "safe", "entry", "late", "game"],
  ages: [10, 18],
  minPlayers: 5,
  defaultPlayers: 10,
  references: [{ title: "5 simple basketball inbound plays (Basketball for Coaches)", url: "https://www.basketballforcoaches.com/basketball-inbound-plays/" }],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-sideline-stack-entry",
      title: "Sideline Stack Entry",
      kind: "play",
      summary: "A simple, safe sideline inbound: a stacked pair splits so the guard pops back to the ball and the big rolls to the rim.",
      objectives: ["Get the ball in safely under pressure", "Use the stack to create separation", "Inbounder steps in for a return pass"],
      court: "half",
      equipment: ["1 ball"],
      setup: ["3 inbounds from the right sideline. 5 and 1 stacked on the right elbow (5 in front). 2 and 4 spaced on the left side."],
      instructions: [
        "1 cuts off 5's back toward half court and calls for the ball.",
        "5 seals and rolls to the rim as the defense chases 1.",
        "3 inbounds to 1, then steps in for a return pass or spaces to the wing.",
      ],
      rotations: ["Rotate inbounders; run with a 5-second count."],
      coachingCues: ["Inbounder: chin the ball, fake", "Cut hard, come to the ball", "Big seals after the screen", "Never pass to the corner trap"],
      variations: ["Lob to 5 if the defense switches", "1 cuts to the basket and 5 pops back to the ball"],
      players: [
        P("O3", "3", "offense", 50, 28, "Inbounder"),
        P("O5", "5", "offense", 35, 22, "Stack front"),
        P("O1", "1", "offense", 35, 24.5, "Stack back"),
        P("O2", "2", "offense", 8, 20, "Left wing"),
        P("O4", "4", "offense", 14, 8, "Left block"),
        ...bench(ctx.playerCount - 5),
      ],
      ballStart: "O3",
      steps: [
        step("Split the stack", "1 cuts back to the ball; 5 seals.", 1.4, [
          move("cut", "O1", 40, 36, 0, 1, { via: [33, 30] }),
          move("screen", "O5", 36.5, 26, 0.1, 0.6, { targetId: "O1" }),
        ]),
        step("Inbound", "Pass to 1; 5 rolls to the rim.", 1.6, [
          pass("O3", "O1", 0, 0.8),
          move("cut", "O5", 30, 8, 0.4, 1.1),
          move("cut", "O3", 44, 24, 0.7, 0.8),
        ]),
        step("Feed the roll", "If 5 sealed, hit the roll.", 1, [pass("O1", "O5", 0, 0.8)]),
        step("Finish", "Layup; 4 rebounds.", 1.2, [shot("O5", "O4", 0, 1)]),
      ],
    };
  },
};

export const pressBreak14: LibraryEntry = {
  key: "press-break-1-4",
  category: "special-situations",
  tags: ["press", "break", "breaker", "1-4", "full", "court", "inbounds", "trap", "pressure", "man", "zone"],
  ages: [10, 18],
  minPlayers: 5,
  defaultPlayers: 10,
  references: [
    { title: "1-4 press break (Basketball for Coaches)", url: "https://www.basketballforcoaches.com/1-4-press-break/" },
    { title: "Press break principles (Breakthrough Basketball)", url: `${BT}/offense/press-breaker` },
  ],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-press-break-1-4",
      title: "1-4 Press Break",
      kind: "play",
      summary: "From a 1-4 alignment, the outside players flash to the ball while the middle players sprint long, then the ball moves up the floor with passes.",
      objectives: ["Inbound safely against pressure", "Attack the press with the pass, not the dribble", "Get the ball to the middle and score in numbers"],
      court: "full",
      equipment: ["1 ball"],
      setup: ["4 inbounds under the far basket. 1, 2, 5 and 3 spread across the far free-throw line extended."],
      instructions: [
        "1 and 3 (outside) flash to the ball; 2 and 5 (inside) sprint long to half court.",
        "4 inbounds to 1 and steps in as the safety.",
        "1 passes up the sideline to 2, who hits 5 in the middle.",
        "5 attacks; 3 fills the right lane for a layup.",
      ],
      rotations: ["5-on-0, then against a 5-man press at half speed. Rotate units."],
      coachingCues: ["Inbounder: run the baseline if allowed", "Meet the pass", "Middle, middle, middle", "No dribbling into traps"],
      variations: ["Inbound to 3 on the right", "Reverse to the safety if 1 is trapped"],
      players: [
        P("O4", "4", "offense", 28, 93.5, "Inbounder"),
        P("O1", "1", "offense", 6, 76, "Left outside"),
        P("O2", "2", "offense", 18, 76, "Left inside"),
        P("O5", "5", "offense", 32, 76, "Right inside"),
        P("O3", "3", "offense", 44, 76, "Right outside"),
        ...bench(ctx.playerCount - 5, 92),
      ],
      ballStart: "O4",
      steps: [
        step("Flash & sprint", "Outside flash back; inside sprint long.", 1.6, [
          move("cut", "O1", 10, 86, 0, 1),
          move("cut", "O3", 40, 86, 0, 1),
          move("cut", "O2", 10, 58, 0, 1.5),
          move("cut", "O5", 30, 54, 0, 1.5),
        ]),
        step("Inbound", "Inbound to 1; 4 steps in as the safety.", 1.6, [pass("O4", "O1", 0, 0.8), move("cut", "O4", 24, 84, 0.6, 0.8)]),
        step("Up the sideline", "1 passes ahead before the trap.", 1.6, [pass("O1", "O2", 0.1, 0.9), move("cut", "O3", 44, 42, 0, 1.6)]),
        step("To the middle", "2 finds 5 in the middle.", 1.6, [move("cut", "O5", 25, 46, 0, 0.6), pass("O2", "O5", 0.5, 0.8)]),
        step("Attack", "5 pushes; 3 fills the lane.", 2.2, [move("dribble", "O5", 25, 22, 0, 1.8), move("cut", "O3", 32, 9, 0, 2, { via: [42, 18] })]),
        step("Layup", "Hit 3 for the layup.", 1.8, [pass("O5", "O3", 0, 0.7), shot("O3", "O5", 0.8, 1)]),
      ],
    };
  },
};

export const noDribble3v3: LibraryEntry = {
  key: "no-dribble-3v3",
  category: "games",
  tags: ["game", "3v3", "no", "dribble", "pass", "cut", "move", "without", "ball", "spacing", "competitive", "small", "sided"],
  ages: [8, 18],
  minPlayers: 6,
  defaultPlayers: 9,
  references: [{ title: "No dribble offense drill (Breakthrough Basketball)", url: `${BT}/haefner/trying-new-drills-no-dribble-is-still-one-of-the-best/` }],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-no-dribble-3v3",
      title: "3-on-3 No-Dribble Game",
      kind: "game",
      summary: "Live 3-on-3 where nobody may dribble, so players must cut, space and pass to score.",
      objectives: ["Move without the ball", "Pass and cut every time", "Read the defender for the give-and-go"],
      court: "half",
      equipment: ["1 ball", "Pinnies"],
      setup: ["Three offensive players (top and wings) against three defenders. Other teams wait at half court."],
      instructions: [
        "No dribbling at all. A dribble is a turnover.",
        "After a pass, cut to the basket or screen away.",
        "Score = 2 points; a give-and-go layup = 3 points.",
      ],
      rotations: ["Winners stay; play to 5 or 3 minutes."],
      coachingCues: ["Pass and cut", "Ball fake to move the defense", "Fill the open spot", "Receiver: step to the ball"],
      variations: ["Allow one dribble only to score", "Add a 5-second count on the ball"],
      players: [
        P("O1", "1", "offense", 25, 28, "Top"),
        P("O2", "2", "offense", 41, 20, "Right wing"),
        P("O3", "3", "offense", 9, 20, "Left wing"),
        P("X1", "X1", "defense", 25, 24),
        P("X2", "X2", "defense", 37, 18),
        P("X3", "X3", "defense", 13, 17),
        ...bench(ctx.playerCount - 6),
      ],
      ballStart: "O1",
      steps: [
        step("Get open", "2 V-cuts against the denial.", 1.8, [
          move("cut", "O2", 38, 12, 0, 0.8),
          move("cut", "O2", 42, 22, 0.8, 0.6),
          move("move", "X2", 38.5, 19, 0.6, 0.8),
          pass("O1", "O2", 1.1, 0.7),
        ]),
        step("Give-and-go", "1 cuts as the defender turns to the ball.", 1.6, [
          move("cut", "O1", 24, 7, 0, 1.3, { via: [22, 17] }),
          move("move", "X1", 26, 12, 0.2, 1.1),
          move("cut", "O3", 18, 26, 0.3, 1.1),
          pass("O2", "O1", 0.8, 0.6),
        ]),
        step("Layup", "Three-point play for the give-and-go.", 1.2, [shot("O1", "X3", 0, 1), move("move", "X3", 21, 9, 0, 1)]),
      ],
    };
  },
};

export const OFFENSE: LibraryEntry[] = [hornsPickAndPop, highBackdoor, driveAndKick, boxBlob, sidelineStack, pressBreak14, noDribble3v3];
