import { cn } from "@/lib/utils";

interface RankBadgeProps {
  rank: number;
  className?: string;
}

export const RankBadge = ({ rank, className }: RankBadgeProps) => {
  return (
    <div 
      className={cn("rank-badge", className)}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </div>
  );
};
