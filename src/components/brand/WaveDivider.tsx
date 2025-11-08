interface WaveDividerProps {
  className?: string;
  flip?: boolean;
}

export const WaveDivider = ({ className = "", flip = false }: WaveDividerProps) => {
  return (
    <div className={`wave-divider w-full ${className}`}>
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className={`w-full h-16 ${flip ? 'rotate-180' : ''}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,0 C300,80 900,80 1200,0 L1200,120 L0,120 Z"
          fill="currentColor"
          className="text-beige/30"
        />
        <path
          d="M0,20 C300,100 900,100 1200,20 L1200,120 L0,120 Z"
          fill="currentColor"
          className="text-aqua/10"
        />
      </svg>
    </div>
  );
};
