import { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  target?: number;
  duration?: number; // in seconds
  isLoading?: boolean;
  className?: string;
}

export const AnimatedCounter = ({ 
  target = 2000000, 
  duration = 8,
  isLoading = true,
  className = "text-5xl md:text-6xl font-bold text-primary"
}: AnimatedCounterProps) => {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset when component mounts
    setCount(0);
    startTimeRef.current = null;
    
    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = (currentTime - startTimeRef.current) / 1000; // seconds
      const durationMs = duration * 1000;

      if (elapsed < duration) {
        // Ease-out cubic for smooth deceleration
        const progress = elapsed / duration;
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const newCount = Math.floor(target * easeProgress);
        setCount(newCount);
        animationFrameRef.current = requestAnimationFrame(animate);
      } else if (isLoading) {
        // After 8 seconds, if still loading, keep incrementing
        const extraTime = elapsed - duration;
        const extraCount = Math.floor(extraTime * 50000); // Add 50k per second after target
        setCount(target + extraCount);
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Finished loading and reached target
        setCount(target);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [target, duration, isLoading]);

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US');
  };

  return (
    <span className={className}>
      {formatNumber(count)}+
    </span>
  );
};
