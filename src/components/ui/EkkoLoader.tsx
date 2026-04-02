import { useEffect, useState, useRef } from "react";

const OFF = "#D5D2CB";
const ON = "#1AE08A";
const STEP_DELAY = 120;
const TRANSITION_MS = 80;
const TOTAL_STEPS = 10;

interface EkkoLoaderProps {
  /** "once" = illuminates then stays green; "loop" = repeats */
  mode?: "once" | "loop";
  /** SVG size in px (default 32) */
  size?: number;
  className?: string;
}

/**
 * Animated Ekko logo loader.
 *
 * 10 elements light up sequentially from top-right to bottom-left:
 *  0  Boule haute droite        (circle 46,6)
 *  1  Trait haut                (line y=6)
 *  2  Boule haute gauche        (circle 9,6)
 *  3  Trait milieu haut         (vertical spine top→mid)
 *  4  Boule milieu              (circle 38,22)
 *  5  Trait milieu bas          (middle horizontal)
 *  6  Trait bas                 (vertical spine mid→bottom)
 *  7  Boule basse droite        (circle 46,48)
 *  8  Trait bas du E            (bottom horizontal)
 *  9  Boule basse gauche        (circle 9,48)
 */
export function EkkoLoader({ mode = "once", size = 32, className = "" }: EkkoLoaderProps) {
  const [lit, setLit] = useState<number>(-1); // index of latest lit element
  const [allOff, setAllOff] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let step = -1;
    setLit(-1);
    setAllOff(false);

    const tick = () => {
      step++;
      if (step < TOTAL_STEPS) {
        setLit(step);
      } else if (step === TOTAL_STEPS) {
        // All lit
        if (mode === "once") {
          // Stay green — stop
          if (timerRef.current) clearInterval(timerRef.current);
          return;
        }
        // loop: brief pause then reset
        setAllOff(true);
      } else {
        // After the off-frame, restart
        step = -1;
        setAllOff(false);
        setLit(-1);
      }
    };

    timerRef.current = setInterval(tick, STEP_DELAY);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode]);

  const color = (index: number) => {
    if (allOff) return OFF;
    return index <= lit ? ON : OFF;
  };

  const transition = `transition: fill ${TRANSITION_MS}ms ease, stroke ${TRANSITION_MS}ms ease`;

  const h = size * (54 / 58);

  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 58 54"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Chargement"
      role="img"
    >
      {/* Step 3: Vertical spine top→mid */}
      <line
        x1="9" y1="6" x2="9" y2="22"
        stroke={color(3)}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transition: `stroke ${TRANSITION_MS}ms ease` }}
      />
      {/* Step 6: Vertical spine mid→bottom */}
      <line
        x1="9" y1="22" x2="9" y2="48"
        stroke={color(6)}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transition: `stroke ${TRANSITION_MS}ms ease` }}
      />
      {/* Step 1: Top horizontal */}
      <line
        x1="9" y1="6" x2="46" y2="6"
        stroke={color(1)}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transition: `stroke ${TRANSITION_MS}ms ease` }}
      />
      {/* Step 5: Middle horizontal */}
      <line
        x1="9" y1="22" x2="38" y2="22"
        stroke={color(5)}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transition: `stroke ${TRANSITION_MS}ms ease` }}
      />
      {/* Step 8: Bottom horizontal */}
      <line
        x1="9" y1="48" x2="46" y2="48"
        stroke={color(8)}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ transition: `stroke ${TRANSITION_MS}ms ease` }}
      />

      {/* Step 2: Boule haute gauche (9,6) */}
      <circle
        cx="9" cy="6" r="6.5"
        fill={color(2)}
        style={{ [transition as any]: undefined, transition: `fill ${TRANSITION_MS}ms ease` }}
      />
      {/* Step 0: Boule haute droite (46,6) */}
      <circle
        cx="46" cy="6" r="5"
        fill="none"
        stroke={color(0)}
        strokeWidth="2"
        style={{ transition: `stroke ${TRANSITION_MS}ms ease` }}
      />
      {/* Step 4: Boule milieu (38,22) */}
      <circle
        cx="38" cy="22" r="4"
        fill="none"
        stroke={color(4)}
        strokeWidth="1.8"
        style={{ transition: `stroke ${TRANSITION_MS}ms ease` }}
      />
      {/* Step 9: Boule basse gauche (9,48) */}
      <circle
        cx="9" cy="48" r="4"
        fill="none"
        stroke={color(9)}
        strokeWidth="1.8"
        style={{ transition: `stroke ${TRANSITION_MS}ms ease` }}
      />
      {/* Step 7: Boule basse droite (46,48) */}
      <circle
        cx="46" cy="48" r="5"
        fill="none"
        stroke={color(7)}
        strokeWidth="2"
        style={{ transition: `stroke ${TRANSITION_MS}ms ease` }}
      />
    </svg>
  );
}
