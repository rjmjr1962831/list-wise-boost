import { AlertTriangle } from 'lucide-react';

type TierName = 'listed' | 'certified' | 'audited' | 'underwritten';

const TIER_ORDER: TierName[] = ['listed', 'certified', 'audited', 'underwritten'];

const TIER_CONFIG: Record<TierName, { leads: number; monthlyPrice: number; uplift: number }> = {
  listed:       { leads: 0,  monthlyPrice: 0,   uplift: 0 },
  certified:    { leads: 16, monthlyPrice: 0,   uplift: 18 },
  audited:      { leads: 32, monthlyPrice: 300, uplift: 28 },
  underwritten: { leads: 48, monthlyPrice: 500, uplift: 37 },
};

const TIER_LABELS: Record<TierName, string> = {
  listed: 'Listed',
  certified: 'Certified',
  audited: 'Audited',
  underwritten: 'Underwritten',
};

const DEAL_SIZE = 750_000;
const COMM_RATE = 0.03;
const CLOSE_RATE = 0.20;
const AIFS_CAP = 95;

function fmtDollar(n: number): string {
  return '$' + (Math.round(n / 1000) * 1000).toLocaleString();
}

function normalizeTier(t: string | null | undefined): TierName {
  const raw = (t || '').toLowerCase();
  if (raw === 'audited' || raw === 'accredited') return 'audited';
  if (raw === 'underwritten') return 'underwritten';
  if (raw === 'certified') return 'certified';
  return 'listed';
}

function calcRevenue(tier: TierName): number {
  const cfg = TIER_CONFIG[tier];
  const commPerDeal = DEAL_SIZE * COMM_RATE;
  const closedDeals = Math.round(cfg.leads * CLOSE_RATE);
  const gross = commPerDeal * closedDeals;
  const annualCost = cfg.monthlyPrice * 12;
  return gross - annualCost;
}

export interface RevenueGapBannerProps {
  professional: {
    current_tier?: string | null;
    badge_tier?: string | null;
    signal_score?: number | null;
  } | null;
}

export function RevenueGapBanner({ professional }: RevenueGapBannerProps) {
  if (!professional) return null;

  const currentTier = normalizeTier(professional.current_tier ?? professional.badge_tier);
  const currentIdx = TIER_ORDER.indexOf(currentTier);

  // Don't show for Underwritten (already top tier)
  if (currentIdx >= TIER_ORDER.length - 1) return null;

  const currentAifs = professional.signal_score ?? 24;
  const currentRevenue = calcRevenue(currentTier);

  // All tiers above the current one
  const upgrades = TIER_ORDER.slice(currentIdx + 1).map((tier) => {
    const revenue = calcRevenue(tier);
    return { tier, label: TIER_LABELS[tier], gap: revenue - currentRevenue };
  }).filter((u) => u.gap > 0);

  if (upgrades.length === 0) return null;

  // Use the highest tier for the headline number
  const topUpgrade = upgrades[upgrades.length - 1];

  return (
    <div className="w-full bg-amber-950/80 border border-amber-700/50 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-amber-200 text-sm font-semibold leading-snug">
            You're leaving up to {fmtDollar(topUpgrade.gap)} in AI-referred revenue on the table.
          </p>
          <p className="text-amber-300/70 text-xs mt-1 leading-relaxed">
            Your current {TIER_LABELS[currentTier]} score ({currentAifs}/100) means AI hedges when naming you.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {upgrades.map((u) => (
              <span key={u.tier} className="text-amber-200 text-xs font-medium">
                {u.label}: <span className="text-amber-300 font-bold">+{fmtDollar(u.gap)}</span>/yr
              </span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-amber-300 text-lg font-bold leading-none">+{fmtDollar(topUpgrade.gap)}</p>
          <p className="text-amber-400/60 text-[10px] mt-0.5">estimated gap / yr</p>
        </div>
      </div>
    </div>
  );
}
