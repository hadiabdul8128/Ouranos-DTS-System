"use client";

import { useEffect, useId } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

/** Background-only adaptation of the supplied HyperGrid. */
export default function MovingGrid({ gridSize = 80 }: { gridSize?: number }) {
  const id = useId();
  const reduced = useReducedMotion();
  const y = useMotionValue(0);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(pointerY, { damping: 40, stiffness: 150 });
  const rotateY = useSpring(pointerX, { damping: 40, stiffness: 150 });

  useEffect(() => {
    if (reduced !== false) return;
    let frame = 0;
    let previous = 0;
    const tick = (time: number) => {
      if (previous) y.set((y.get() - Math.min(time - previous, 50) * 0.006) % gridSize);
      previous = time;
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || document.hidden) return;
      pointerX.set((event.clientX / window.innerWidth - 0.5) * 2);
      pointerY.set((0.5 - event.clientY / window.innerHeight) * 2);
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pointermove", move);
    };
  }, [reduced, gridSize, y, pointerX, pointerY]);

  return (
    <div className="hyper-grid" aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden", perspective: 1200, background: "#000" }}>
      <motion.div className="hyper-grid-plane" style={{ position: "absolute", inset: -80, rotateX: reduced ? 0 : rotateX, rotateY: reduced ? 0 : rotateY }}>
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <motion.pattern id={id} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse" y={y}>
              <path d={`M ${gridSize} 0 H 0 V ${gridSize}`} fill="none" stroke="white" strokeOpacity="0.075" strokeWidth="0.6" />
              <path d="M 0 4 V 0 H 4" fill="none" stroke="white" strokeOpacity="0.22" strokeWidth="1" />
            </motion.pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </svg>
      </motion.div>
    </div>
  );
}
