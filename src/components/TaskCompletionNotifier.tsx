import { useEffect } from 'react';
import { playTaskCompletionSound } from '@/utils/taskCompletionSound';

// Component that exposes the sound globally and can be triggered by Lovable
export const TaskCompletionNotifier = () => {
  useEffect(() => {
    // Expose the sound function globally so Lovable can call it
    (window as any).playTaskCompletionSound = playTaskCompletionSound;
    
    // Clean up on unmount
    return () => {
      delete (window as any).playTaskCompletionSound;
    };
  }, []);

  return null; // This component doesn't render anything
};
