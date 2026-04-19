"use client"
// Lightweight fallback for GSAP's paid Club-GSAP SplitText plugin (not on npm).
// Keeps the original component signature so callers like app/page.tsx keep working,
// but replaces per-char/line animation with a single fade-up using free GSAP + IntersectionObserver.
import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  ease?: string;
  splitType?: 'chars' | 'words' | 'lines' | 'words, chars';
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  threshold?: number;
  rootMargin?: string;
  textAlign?: 'left' | 'center' | 'right';
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
  onLetterAnimationComplete?: () => void;
}

const SplitText = ({
  text,
  className = '',
  duration = 1.25,
  ease = 'power3.out',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'center',
  tag = 'p',
  display = 'block',
  overflow = 'hidden',
  onLetterAnimationComplete,
}: SplitTextProps & { display?: string; overflow?: string }) => {
  const ref = useRef<HTMLElement | null>(null);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    if (played || !ref.current || !text) return;
    const el = ref.current;

    gsap.set(el, from);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          gsap.to(el, {
            ...to,
            duration,
            ease,
            onComplete: () => {
              setPlayed(true);
              onLetterAnimationComplete?.();
            },
          });
          io.disconnect();
        }
      },
      { threshold, rootMargin },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [text, duration, ease, threshold, rootMargin, played, from, to, onLetterAnimationComplete]);

  const style: React.CSSProperties = {
    textAlign,
    overflow: overflow as React.CSSProperties['overflow'],
    display: display as React.CSSProperties['display'],
    whiteSpace: 'normal',
    wordWrap: 'break-word',
    willChange: 'transform, opacity',
  };
  const Tag = tag || 'p';

  return (
    <Tag ref={ref as never} style={style} className={`split-parent ${className}`}>
      {text}
    </Tag>
  );
};

export default SplitText;
