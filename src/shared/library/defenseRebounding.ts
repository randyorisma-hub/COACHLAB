/** Defense and rebounding drills. */
import { bench, base, line, move, P, pass, shot, split, step, type BuildContext, type LibraryEntry } from "./dsl";

const BT = "https://www.breakthroughbasketball.com";

export const zigZagSlides: LibraryEntry = {
  key: "zig-zag-slides",
  category: "defense",
  tags: ["defense", "defensive", "slide", "slides", "stance", "footwork", "drop", "step", "zig", "zag", "conditioning", "full"],
  ages: [8, 18],
  minPlayers: 1,
  defaultPlayers: 8,
  references: [{ title: "Defensive slide drill (Breakthrough Basketball)", url: `${BT}/defense/step-slide` }],
  build(ctx: BuildContext) {
    const D = line("X", "defense", 1, Math.min(Math.max(ctx.playerCount, 1), 30), 46, 92, -2.6, 0, "Slide line", 94);
    return {
      ...base(ctx),
      id: "lib-zig-zag-slides",
      title: "Full-Court Zig-Zag Slides",
      kind: "drill",
      summary: "Defenders slide the length of the floor in a zig-zag, using a drop step at every change of direction.",
      objectives: ["Stay low in a wide stance", "Push off the trail foot; don't click heels", "Open the hips with a quick drop step"],
      court: "full",
      equipment: ["Optional cones at the turns"],
      setup: ["One line in the far corner. Each defender starts when the one ahead reaches the first turn."],
      instructions: [
        "Slide diagonally toward the middle of the floor.",
        "At the turn, drop step (swing the back foot open) and slide toward the sideline.",
        "Repeat to the far baseline, then jog back along the sideline.",
      ],
      rotations: ["Continuous; second trip down, add an offensive player dribbling at 50% speed."],
      coachingCues: ["Nose over toes, low hips", "Push, don't hop", "Quick drop step", "Hands active"],
      variations: ["Add a ball handler (1v1 zig-zag)", "Sprint the last third, then close out"],
      players: D,
      ballStart: null,
      steps: [
        step("Slide", "Wide stance, push off the trail foot.", 1.8, [move("move", "X1", 28, 80, 0, 1.8)]),
        step("Drop step", "Swing the hips, slide the other way.", 1.8, [move("move", "X1", 44, 66, 0, 1.8)]),
        step("Drop step", "Stay low through the turn.", 1.8, [move("move", "X1", 28, 52, 0, 1.8)]),
        step("Drop step", "Hands active, eyes forward.", 1.8, [move("move", "X1", 44, 38, 0, 1.8)]),
        step("Drop step", "Finish strong to the baseline.", 1.8, [move("move", "X1", 28, 24, 0, 1.8)]),
      ],
    };
  },
};

export const closeout1v1: LibraryEntry = {
  key: "closeout-1v1",
  category: "defense",
  tags: ["defense", "closeout", "close", "out", "contest", "1v1", "live", "help", "recover", "competitive"],
  ages: [11, 18],
  minPlayers: 2,
  defaultPlayers: 8,
  references: [{ title: "5 closeout drills every coach should use (Breakthrough Basketball)", url: `${BT}/drills/five-closeout-drills` }],
  build(ctx: BuildContext) {
    const [no, nd] = split(Math.max(ctx.playerCount, 2), 2);
    const O = line("O", "offense", 1, no, 44, 24, 1, 2.4, "Offense line");
    const D = line("X", "defense", 1, nd, 22, 3, -2.4, 0, "Defense line");
    return {
      ...base(ctx),
      id: "lib-closeout-1v1",
      title: "Closeout to 1-on-1",
      kind: "drill",
      summary: "The defender passes out to the wing, closes out under control and plays 1-on-1 live.",
      objectives: ["Sprint the first two-thirds, chop the last third", "Contest high without leaving the floor", "Take away the middle drive"],
      court: "half",
      equipment: ["1 ball"],
      setup: [`Defense line (${nd}) under the basket with the ball. Offense line (${no}) on the right wing.`],
      instructions: [
        "Defender passes to the wing and closes out.",
        "Offense catches and attacks the closeout with a shot, drive or shot fake and drive.",
        "Play to one stop or score. Defender must finish with a box-out.",
      ],
      rotations: ["Offense → defense line, defense → offense line. Play to 3 stops."],
      coachingCues: ["Sprint, then chop", "High hand, low butt", "Force the baseline", "Finish with a box-out"],
      variations: ["Offense limited to two dribbles", "Start the defender in help on the weak-side block"],
      players: [...O, ...D],
      ballStart: "X1",
      steps: [
        step("Pass out", "Defender passes to the wing.", 1, [pass("X1", "O1", 0, 0.8)]),
        step("Closeout", "Sprint, then short choppy steps.", 1.4, [move("move", "X1", 39, 19, 0, 1.2)]),
        step("Attack", "Offense drives the baseline; defender slides.", 1.6, [
          move("dribble", "O1", 34, 7, 0, 1.4, { via: [43, 13] }),
          move("move", "X1", 33, 9.5, 0.1, 1.2),
        ]),
        step("Contest & box out", "Contest, then find a body.", 1.4, [shot("O1", "X1", 0, 1)]),
      ],
    };
  },
};

export const denyHelp2v2: LibraryEntry = {
  key: "deny-and-help-2v2",
  category: "defense",
  tags: ["defense", "deny", "denial", "help", "side", "backdoor", "recover", "2v2", "positioning", "rotation"],
  ages: [11, 18],
  minPlayers: 5,
  defaultPlayers: 9,
  references: [{ title: "Youth defense drills (Breakthrough Basketball)", url: `${BT}/drills/kids-youth` }],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-deny-and-help-2v2",
      title: "2-on-2 Deny, Help & Recover",
      kind: "drill",
      summary: "One defender denies the wing, the other plays help. The backdoor cut is helped, then both recover to their players.",
      objectives: ["Deny one pass away", "Help from the weak side on backdoor cuts", "Recover to shooters after helping"],
      court: "half",
      equipment: ["1 ball", "Coach at the top"],
      setup: ["Coach at the top with the ball. Offense on both wings. One defender denies the right wing; the other sits in help."],
      instructions: [
        "Right wing tries to get open; defender denies with hand and foot in the lane.",
        "On the backdoor cut, the help defender rotates to stop the layup.",
        "Ball is kicked to the open wing; help defender recovers with a closeout.",
      ],
      rotations: ["Offense to defense, defense off, new pair on offense. Rotate after 3 reps."],
      coachingCues: ["Ball-you-man", "Open up on the backdoor", "Help, then recover", "Talk: deny, help, ball"],
      variations: ["Play live after the kick-out", "Add a third pair for 3-on-3"],
      players: [
        P("C", "C", "coach", 25, 30, "Coach"),
        P("O1", "1", "offense", 42, 20, "Right wing"),
        P("O2", "2", "offense", 8, 20, "Left wing"),
        P("X1", "X1", "defense", 38, 17.5, "Denial"),
        P("X2", "X2", "defense", 18, 12, "Help"),
        ...bench(ctx.playerCount - 5),
      ],
      ballStart: "C",
      steps: [
        step("Deny", "Hand and foot in the passing lane.", 1.6, [
          move("cut", "O1", 41, 25, 0, 1.2),
          move("move", "X1", 38.5, 22.5, 0.1, 1.2),
        ]),
        step("Backdoor & help", "Help defender rotates to the rim.", 1.8, [
          move("cut", "O1", 30, 7, 0, 1.1, { via: [41, 13] }),
          move("move", "X1", 34, 11, 0.2, 1.1),
          move("move", "X2", 25, 8, 0.3, 0.9),
        ]),
        step("Bounce pass", "Help is there; the cutter catches under pressure.", 1.2, [pass("C", "O1", 0, 0.8)]),
        step("Kick & recover", "Recover with a controlled closeout.", 1.8, [
          pass("O1", "O2", 0, 1),
          move("move", "X2", 11, 18, 0.2, 1.2),
          move("move", "X1", 22, 11, 0.5, 1),
        ]),
      ],
    };
  },
};

export const boxOut3v3: LibraryEntry = {
  key: "shot-and-box-out-3v3",
  category: "rebounding",
  tags: ["rebound", "rebounding", "box", "out", "boxout", "3v3", "outlet", "defense", "toughness", "competitive"],
  ages: [10, 18],
  minPlayers: 6,
  defaultPlayers: 10,
  references: [
    { title: "3 box out drills (Basketball for Coaches)", url: "https://www.basketballforcoaches.com/box-out-drills/" },
    { title: "Rebounding box-out drills (Coach's Clipboard)", url: "https://www.coachesclipboard.net/ReboundingBoxOutDrills.html" },
  ],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-shot-and-box-out-3v3",
      title: "3-on-3 Shot & Box-Out",
      kind: "drill",
      summary: "The coach shoots; three defenders find, hit and hold their players, then secure the rebound and outlet.",
      objectives: ["Find your player as the shot goes up", "Make contact first and hold it", "Secure and outlet the rebound"],
      court: "half",
      equipment: ["1 ball", "Coach at the top"],
      setup: ["Offense on the left wing, right wing and right short corner. Defenders between their player and the basket."],
      instructions: [
        "Coach shoots from the top.",
        "Defenders turn, make contact and push their player away from the basket.",
        "Defense secures the rebound and outlets to the wing. Offense crashes hard.",
      ],
      rotations: ["Defense must get 3 rebounds in a row to rotate off; offense becomes the defense."],
      coachingCues: ["Find, hit, get", "Butt to thighs, arms wide", "Go get the ball, two hands", "Outlet to the side"],
      variations: ["Offensive rebound = 2 points; defensive rebound = 1 point", "Coach passes first, then shoots"],
      players: [
        P("C", "C", "coach", 25, 28, "Shooter"),
        P("O1", "1", "offense", 9, 20, "Left wing"),
        P("O2", "2", "offense", 41, 20, "Right wing"),
        P("O3", "3", "offense", 40, 6, "Short corner"),
        P("X1", "X1", "defense", 13, 17),
        P("X2", "X2", "defense", 37, 17),
        P("X3", "X3", "defense", 36, 7),
        ...bench(ctx.playerCount - 6),
      ],
      ballStart: "C",
      steps: [
        step("Shot & hit", "Turn, find a body, make contact.", 1.6, [
          shot("C", "X3", 0.2, 1.3),
          move("move", "X1", 15.5, 14, 0.3, 0.8),
          move("move", "X2", 34.5, 14, 0.3, 0.8),
          move("move", "X3", 31, 6.5, 0.3, 0.8),
          move("cut", "O1", 14, 16, 0.3, 0.9),
          move("cut", "O2", 36, 16, 0.3, 0.9),
          move("cut", "O3", 35, 6.5, 0.3, 0.9),
        ]),
        step("Outlet", "Secure it, pivot outside, outlet.", 1.6, [
          move("cut", "X2", 44, 24, 0, 1),
          pass("X3", "X2", 0.8, 0.8),
        ]),
      ],
    };
  },
};

export const freeThrowBoxOut: LibraryEntry = {
  key: "free-throw-box-out",
  category: "rebounding",
  tags: ["free", "throw", "foul", "shot", "box", "out", "rebound", "lane", "special", "situations"],
  ages: [10, 18],
  minPlayers: 5,
  defaultPlayers: 10,
  references: [{ title: "3 box out drills (Basketball for Coaches)", url: "https://www.basketballforcoaches.com/box-out-drills/" }],
  build(ctx: BuildContext) {
    return {
      ...base(ctx),
      id: "lib-free-throw-box-out",
      title: "Free-Throw Box-Out",
      kind: "drill",
      summary: "Practice lane positions on a missed free throw: step in, hit the offensive player and secure the rebound.",
      objectives: ["Step across into the lane first", "Seal the offensive player out", "Outlet away from pressure"],
      court: "half",
      equipment: ["1 ball"],
      setup: ["Shooter at the free-throw line. Defenders on the lane spots nearest the basket, offense on the next spots up, one defender at the top."],
      instructions: [
        "Shooter shoots; nobody moves until the ball leaves the hand.",
        "Lane defenders step across with the inside foot and seal their player.",
        "Rebound with two hands and outlet to the guard who releases to the wing.",
      ],
      rotations: ["Rotate spots each rep; shooter makes two in a row to rotate out."],
      coachingCues: ["Step in, then turn", "Hit first", "Hold the seal", "Guard releases to the wing"],
      variations: ["Shooter's team scores for offensive rebounds", "Shooter intentionally misses"],
      players: [
        P("SH", "S", "offense", 25, 19, "Shooter"),
        P("X1", "X1", "defense", 16, 8, "Left lane"),
        P("X2", "X2", "defense", 34, 8, "Right lane"),
        P("O1", "1", "offense", 16, 11.5, "Left lane"),
        P("O2", "2", "offense", 34, 11.5, "Right lane"),
        P("X3", "X3", "defense", 25, 26, "Guard"),
        ...bench(ctx.playerCount - 6),
      ],
      ballStart: "SH",
      steps: [
        step("Shot", "Move on the release.", 1.6, [
          shot("SH", "X2", 0, 1.4),
          move("move", "X1", 19, 9.5, 0.2, 0.6),
          move("move", "X2", 31, 9.5, 0.2, 0.6),
          move("cut", "O1", 18.5, 12.5, 0.2, 0.7),
          move("cut", "O2", 31.5, 12.5, 0.2, 0.7),
          move("cut", "X3", 44, 22, 0.4, 1),
        ]),
        step("Outlet", "Pivot to the sideline and outlet.", 1.4, [pass("X2", "X3", 0.1, 0.9)]),
      ],
    };
  },
};

export const DEFENSE_REBOUNDING: LibraryEntry[] = [zigZagSlides, closeout1v1, denyHelp2v2, boxOut3v3, freeThrowBoxOut];
