import { motion, useIsPresent, useReducedMotion } from 'motion/react';
import { forwardRef, type ReactNode } from 'react';
import { motionEnter, motionExit } from './DeviceModal';

export const PageSurface = forwardRef<HTMLDivElement, { children: ReactNode; direction: 'forward' | 'back'; className?: string }>(
  function PageSurface({ children, direction, className = '' }, ref) {
    const present = useIsPresent();
    const reduced = useReducedMotion();
    return <motion.div ref={ref} inert={!present} className={`page-surface ${className}`}
      initial={direction === 'back' ? false : { opacity: 0, x: reduced ? 0 : 16 }}
      animate={{ opacity: 1, x: 0, transition: { duration: reduced ? 0 : .24, ease: motionEnter } }}
      exit={{ opacity: 0, x: reduced ? 0 : 16, transition: { duration: reduced ? 0 : .2, ease: motionExit } }}>
      {children}
    </motion.div>;
  },
);
