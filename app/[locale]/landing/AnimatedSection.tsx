'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type AnimationType = 'fadeUp' | 'scaleIn' | 'slideLeft' | 'slideRight' | 'fadeIn';

type AnimatedSectionProps = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  animation?: AnimationType;
  custom?: number;
  once?: boolean;
  useViewport?: boolean;
};

const MD3_EASE = [0.2, 0, 0, 1] as const;

const animations = {
  fadeUp: {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.5, delay: i * 0.12, ease: MD3_EASE },
    }),
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.92 },
    visible: (i: number) => ({
      opacity: 1, scale: 1,
      transition: { duration: 0.45, delay: i * 0.1, ease: MD3_EASE },
    }),
  },
  slideLeft: {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: MD3_EASE } },
  },
  slideRight: {
    hidden: { opacity: 0, x: 30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, delay: 0.1, ease: MD3_EASE } },
  },
  fadeIn: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: MD3_EASE } },
  },
};

export default function AnimatedSection({
  children,
  className,
  style,
  animation = 'fadeIn',
  custom = 0,
  once = true,
  useViewport = false,
}: AnimatedSectionProps) {
  const variant = animations[animation];
  const viewportProps = useViewport
    ? { whileInView: 'visible' as const, viewport: { once } }
    : { animate: 'visible' as const };

  return (
    <motion.div
      className={className}
      style={style}
      custom={custom}
      variants={variant}
      initial="hidden"
      {...viewportProps}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCard({
  children,
  className,
  style,
  index = 0,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  index?: number;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: delay + index * 0.15, ease: MD3_EASE }}
    >
      {children}
    </motion.div>
  );
}
