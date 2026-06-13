"use client";

import { motion, type HTMLMotionProps } from "motion/react";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

type RevealProps = HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
};

// Fades content in with a small upward motion. Used to bring pages and cards
// to life as they mount.
export function Reveal({ children, delay = 0, y = 12, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: EASE }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Staggers direct children when used together with RevealItem.
export function RevealGroup({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06 } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
