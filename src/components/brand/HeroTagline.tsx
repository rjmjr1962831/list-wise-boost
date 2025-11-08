interface HeroTaglineProps {
  text: string;
  subtext?: string;
  className?: string;
}

export const HeroTagline = ({ text, subtext, className = "" }: HeroTaglineProps) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <h1 className="tagline text-4xl md:text-6xl font-bold text-indigo leading-tight">
        {text}
      </h1>
      {subtext && (
        <p className="text-xl md:text-2xl text-graphite/70 font-light">
          {subtext}
        </p>
      )}
    </div>
  );
};
