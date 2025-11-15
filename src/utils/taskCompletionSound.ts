// Utility to play a subtle chime when tasks complete
export const playTaskCompletionSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a pleasant chime using oscillators
    const now = audioContext.currentTime;
    
    // First note (E)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.frequency.value = 659.25; // E5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.start(now);
    osc1.stop(now + 0.3);
    
    // Second note (G#) - slight delay
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.frequency.value = 830.61; // G#5
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.4);
    
    // Third note (B) - harmonious finish
    const osc3 = audioContext.createOscillator();
    const gain3 = audioContext.createGain();
    osc3.connect(gain3);
    gain3.connect(audioContext.destination);
    osc3.frequency.value = 987.77; // B5
    gain3.gain.setValueAtTime(0, now + 0.15);
    gain3.gain.linearRampToValueAtTime(0.2, now + 0.17);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc3.start(now + 0.15);
    osc3.stop(now + 0.5);
    
    console.log('✓ Task completion chime played');
  } catch (error) {
    console.warn('Could not play completion sound:', error);
  }
};
