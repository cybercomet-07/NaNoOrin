"use client";

import React, { useEffect, useMemo, useRef, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './ScrollFloat.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScrollFloatProps {
  children: ReactNode;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  containerClassName?: string;
  textClassName?: string;
  animationDuration?: number;
  ease?: string;
  scrollStart?: string;
  scrollEnd?: string;
  stagger?: number;
  mode?: 'text' | 'elements';
  as?: keyof JSX.IntrinsicElements;
}

const ScrollFloat: React.FC<ScrollFloatProps> = ({
  children,
  scrollContainerRef,
  containerClassName = '',
  textClassName = '',
  animationDuration = 1,
  ease = 'back.inOut(2)',
  scrollStart = 'center bottom+=50%',
  scrollEnd = 'bottom bottom-=40%',
  stagger = 0.03,
  mode = 'text',
  as: Tag = 'h2'
}) => {
  const containerRef = useRef<HTMLElement>(null);

  const content = useMemo(() => {
    if (mode === 'text' && typeof children === 'string') {
      return children.split('').map((char, index) => (
        <span className="char" key={index}>
          {char === ' ' ? '\u00A0' : char}
        </span>
      ));
    }
    
    // In elements mode, we just render the children as-is.
    // We'll target the direct children of the container for animation.
    return children;
  }, [children, mode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scroller = scrollContainerRef?.current || window;

    // Target either .char or immediate children based on mode
    const targets = mode === 'text' 
      ? el.querySelectorAll('.char') 
      : el.children;

    if (!targets.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        {
          willChange: 'opacity, transform',
          opacity: 0,
          yPercent: 80, // Reduced from 120 for smoother feel
          scaleY: 1.5,   // Reduced from 2.3 for less 'messy' stretch
          scaleX: 0.9,
          transformOrigin: '50% 0%'
        },
        {
          duration: animationDuration,
          ease: ease,
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          stagger: stagger,
          scrollTrigger: {
            trigger: el,
            scroller: scroller,
            start: scrollStart,
            end: scrollEnd,
            scrub: true,
          }
        }
      );
    }, el);

    return () => ctx.revert();
  }, [scrollContainerRef, animationDuration, ease, scrollStart, scrollEnd, stagger, mode]);

  return (
    <Tag ref={containerRef as any} className={`scroll-float ${containerClassName}`}>
      <span className={`scroll-float-text ${textClassName}`}>
        {content}
      </span>
    </Tag>
  );
};

export default ScrollFloat;
