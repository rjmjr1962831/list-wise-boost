import { 
  Home, 
  DollarSign, 
  Ruler, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  Store,
  Move,
  Key,
  Wallet,
  Minus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NeighborhoodMarketStats } from "@/types/neighborhoodMarketStats";

interface NeighborhoodMarketStatsCardProps {
  stats: NeighborhoodMarketStats;
  neighborhoodName?: string;
  tier?: string;
}

const getTierDisplayName = (tier: string): string => {
  switch (tier?.toLowerCase()) {
    case 'luxury':
      return 'Luxury Market';
    case 'prime':
      return 'Prime Market';
    case 'main':
      return 'Main Market';
    default:
      return tier || 'Market';
  }
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number): string => {
  // If value is already in decimal form (e.g., 0.72), multiply by 100
  const percentValue = value < 1 ? value * 100 : value;
  return `${percentValue.toFixed(1)}%`;
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

export function NeighborhoodMarketStatsCard({ stats, neighborhoodName, tier }: NeighborhoodMarketStatsCardProps) {
  const getYoYTrendIcon = () => {
    if (stats.yearOverYearChange > 0.5) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (stats.yearOverYearChange < -0.5) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getYoYColor = () => {
    if (stats.yearOverYearChange > 0.5) return "text-green-600";
    if (stats.yearOverYearChange < -0.5) return "text-red-600";
    return "text-muted-foreground";
  };

  const getMarketTypeBadgeVariant = (): "destructive" | "secondary" | "default" => {
    if (stats.marketType === "Seller's Market") return "destructive";
    if (stats.marketType === "Buyer's Market") return "default";
    return "secondary";
  };

  const getInventoryColor = () => {
    if (stats.inventoryLevel === "Low") return "text-red-600";
    if (stats.inventoryLevel === "High") return "text-green-600";
    return "text-yellow-600";
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {neighborhoodName || stats.metadata?.neighborhoodName || 'Neighborhood'} Market Statistics
          </CardTitle>
          {tier && (
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
              {getTierDisplayName(tier)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Row 1: Primary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Home className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Median Price</p>
              <p className="text-sm font-semibold">{formatCurrency(stats.medianHomePrice)}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Median Rent</p>
              <p className="text-sm font-semibold">{formatCurrency(stats.medianRent)}/mo</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Ruler className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Price/Sq Ft</p>
              <p className="text-sm font-semibold">{formatCurrency(stats.pricePerSqFt)}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Days on Market</p>
              <p className="text-sm font-semibold">{stats.daysOnMarket} days</p>
            </div>
          </div>
        </div>

        {/* Row 2: Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            {getYoYTrendIcon()}
            <div>
              <p className="text-xs text-muted-foreground">YoY Change</p>
              <p className={`text-sm font-medium ${getYoYColor()}`}>
                {stats.yearOverYearChange > 0 ? '+' : ''}{formatPercent(stats.yearOverYearChange)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Inventory</p>
              <p className={`text-sm font-medium ${getInventoryColor()}`}>
                {stats.inventoryLevel}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Market Type</p>
              <Badge variant={getMarketTypeBadgeVariant()} className="text-xs mt-0.5">
                {stats.marketType}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Move className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Avg Home Size</p>
              <p className="text-sm font-medium">{formatNumber(stats.averageHomeSize)} sqft</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Ownership Rate</p>
              <p className="text-sm font-medium">{formatPercent(stats.homeownershipRate)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Median Income</p>
              <p className="text-sm font-medium">{formatCurrency(stats.medianHouseholdIncome)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
