import { useCallback, useEffect, useRef, useState } from "react";
import { boundaries, type Timeline } from "../shared/engine";

export const SPEEDS = [0.25, 0.5, 1, 1.5, 2] as const;

export interface Playback {
  time: number;
  playing: boolean;
  speed: number;
  loop: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  setSpeed: (s: number) => void;
  setLoop: (l: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  restart: () => void;
}

/** Drives the animation clock. All positions come from the engine's frameAt(time). */
export function usePlayback(timeline: Timeline): Playback {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const total = timeline.total;
  const timeRef = useRef(0);
  timeRef.current = time;

  // Keep time valid when the activity is edited.
  useEffect(() => {
    if (timeRef.current > total) setTime(total);
  }, [total]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1) * speed;
      last = now;
      let next = timeRef.current + dt;
      if (next >= total) {
        if (loop && total > 0) next = 0;
        else {
          setTime(total);
          setPlaying(false);
          return;
        }
      }
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, total, loop]);

  const play = useCallback(() => {
    if (total <= 0) return;
    if (timeRef.current >= total - 1e-6) setTime(0);
    setPlaying(true);
  }, [total]);
  const pause = useCallback(() => setPlaying(false), []);
  const seek = useCallback((t: number) => setTime(Math.min(Math.max(t, 0), total)), [total]);

  const nextStep = useCallback(() => {
    setPlaying(false);
    const b = boundaries(timeline);
    const t = b.find((x) => x > timeRef.current + 1e-6);
    setTime(t ?? total);
  }, [timeline, total]);

  const prevStep = useCallback(() => {
    setPlaying(false);
    const b = boundaries(timeline);
    const earlier = b.filter((x) => x < timeRef.current - 1e-6);
    setTime(earlier.length ? earlier[earlier.length - 1] : 0);
  }, [timeline]);

  return {
    time,
    playing,
    speed,
    loop,
    play,
    pause,
    toggle: () => (playing ? pause() : play()),
    seek,
    setSpeed,
    setLoop,
    nextStep,
    prevStep,
    restart: () => {
      setPlaying(false);
      setTime(0);
    },
  };
}
