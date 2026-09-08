'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/components/icons';

export function HeroOrbit() {
  const visual = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = visual.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect();
      element.style.setProperty(
        '--orbit-x',
        `${((event.clientX - bounds.left) / bounds.width - 0.5) * 8}deg`,
      );
      element.style.setProperty(
        '--orbit-y',
        `${((event.clientY - bounds.top) / bounds.height - 0.5) * -8}deg`,
      );
    };
    element.addEventListener('pointermove', move);
    return () => element.removeEventListener('pointermove', move);
  }, []);
  return (
    <div className="hero-orbit" ref={visual} aria-label="Connected work network visual">
      <div className="hero-orbit__rings" />
      <div className="hero-orbit__core">
        <span className="hero-orbit__core-mark">
          <i />
          <i />
          <i />
        </span>
        <strong>together</strong>
        <small>is stronger</small>
      </div>
      <div className="orbit-chip orbit-chip--top">
        <span className="orbit-chip__icon">
          <Icon name="verify" />
        </span>
        <span>
          <b>Verified skills</b>
          <small>Trust you can see</small>
        </span>
      </div>
      <div className="orbit-chip orbit-chip--right">
        <span className="orbit-chip__icon">
          <Icon name="users" />
        </span>
        <span>
          <b>12,400+</b>
          <small>Member network</small>
        </span>
      </div>
      <div className="orbit-chip orbit-chip--bottom">
        <span className="orbit-chip__icon">
          <Icon name="briefcase" />
        </span>
        <span>
          <b>Fair opportunity</b>
          <small>Close to home</small>
        </span>
      </div>
      <span className="orbit-dot orbit-dot--one" />
      <span className="orbit-dot orbit-dot--two" />
      <span className="orbit-dot orbit-dot--three" />
    </div>
  );
}
