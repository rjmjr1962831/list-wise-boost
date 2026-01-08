import { useState } from 'react';
import { TierBadge } from '@/components/visibility/TierBadge';
import { CoverageProgress } from '@/components/visibility/CoverageProgress';
import { CitiesPanel, CityOption } from '@/components/visibility/CitiesPanel';
import { BundlesPanel, CityBundle } from '@/components/visibility/BundlesPanel';
import { NeighborhoodsPanel } from '@/components/visibility/NeighborhoodsPanel';
import { CoverageSummaryCard } from '@/components/visibility/CoverageSummaryCard';
import { CoverageSummaryFooter } from '@/components/visibility/CoverageSummaryFooter';
import { ReviewSummaryCard } from '@/components/visibility/ReviewSummaryCard';
import type { SelectedNeighborhood, QuoteCartResponse } from '@/types/neighborhoodPricing';

// Mock data
const mockCities: CityOption[] = [
  { id: '1', name: 'Phoenix', slug: 'phoenix', metro: 'Phoenix Metro' },
  { id: '2', name: 'Scottsdale', slug: 'scottsdale', metro: 'Phoenix Metro' },
  { id: '3', name: 'Mesa', slug: 'mesa', metro: 'Phoenix Metro' },
  { id: '4', name: 'Tempe', slug: 'tempe', metro: 'Phoenix Metro' },
  { id: '5', name: 'Chandler', slug: 'chandler', metro: 'Phoenix Metro' },
  { id: '6', name: 'Gilbert', slug: 'gilbert', metro: 'Phoenix Metro' },
];

const mockBundles: CityBundle[] = [
  { id: 'b1', name: 'East Valley', description: 'Mesa, Tempe, Chandler, Gilbert', cityIds: ['3', '4', '5', '6'] },
  { id: 'b2', name: 'Phoenix Core', description: 'Phoenix and Scottsdale', cityIds: ['1', '2'] },
];

const initialSelectedNeighborhoods: SelectedNeighborhood[] = [
  { id: 'n1', neighborhood: 'Arcadia', city_area: 'Phoenix', state: 'AZ', tier_at_selection: 'Luxury', price_monthly: 99, price_source: 'tier_base' },
  { id: 'n2', neighborhood: 'Downtown Scottsdale', city_area: 'Scottsdale', state: 'AZ', tier_at_selection: 'Prime', price_monthly: 69, price_source: 'tier_base' },
];

const mockCityNames = new Map([
  ['1', 'Phoenix'],
  ['2', 'Scottsdale'],
  ['3', 'Mesa'],
  ['4', 'Tempe'],
  ['5', 'Chandler'],
  ['6', 'Gilbert'],
]);

const mockQuote: QuoteCartResponse = {
  config_version_used: 'v1',
  items: [
    { neighborhood_id: 'n1', neighborhood: 'Arcadia', city_area: 'Phoenix', tier: 'Luxury', final_price_monthly: 99, price_source: 'tier_prices' },
    { neighborhood_id: 'n2', neighborhood: 'Downtown Scottsdale', city_area: 'Scottsdale', tier: 'Prime', final_price_monthly: 69, price_source: 'tier_prices' },
  ],
  total_monthly: 168,
  total_annual: 1680,
};

export default function TestVisibilityComponents() {
  // Interactive state for testing
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set(['1', '2', '3']));
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<SelectedNeighborhood[]>(initialSelectedNeighborhoods);
  const [progressStep, setProgressStep] = useState<'setup' | 'review' | 'payment'>('setup');

  const subtotalMonthly = selectedNeighborhoods.reduce((sum, n) => sum + n.price_monthly, 0);

  const handleAddBundle = (bundleId: string, cityIds: string[]) => {
    const next = new Set(selectedCities);
    cityIds.forEach((id) => next.add(id));
    setSelectedCities(next);
  };

  const handleAddNeighborhood = (n: SelectedNeighborhood) => {
    if (!selectedNeighborhoods.some((existing) => existing.id === n.id)) {
      setSelectedNeighborhoods([...selectedNeighborhoods, n]);
    }
  };

  const handleRemoveNeighborhood = (id: string) => {
    setSelectedNeighborhoods(selectedNeighborhoods.filter((n) => n.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* DEV ONLY Banner */}
      <div className="bg-amber-500 text-black py-2 px-4 text-center font-semibold">
        ⚠️ DEV ONLY - Component Test Page - Will be deleted after testing
      </div>

      <div className="container mx-auto py-8 px-4 max-w-6xl space-y-12">
        <h1 className="text-3xl font-bold">Phase 2: Visibility Components Test</h1>

        {/* 1. TierBadge */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">1. TierBadge</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Size: sm</p>
              <div className="flex gap-2">
                <TierBadge tier="Main" size="sm" />
                <TierBadge tier="Prime" size="sm" />
                <TierBadge tier="Luxury" size="sm" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Size: md</p>
              <div className="flex gap-2">
                <TierBadge tier="Main" size="md" />
                <TierBadge tier="Prime" size="md" />
                <TierBadge tier="Luxury" size="md" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">With Price</p>
              <div className="flex gap-2">
                <TierBadge tier="Main" showPrice size="sm" />
                <TierBadge tier="Prime" showPrice size="sm" />
                <TierBadge tier="Luxury" showPrice size="sm" />
              </div>
            </div>
          </div>
        </section>

        {/* 2. CoverageProgress */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">2. CoverageProgress</h2>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setProgressStep('setup')}
              className={`px-3 py-1 rounded text-sm ${progressStep === 'setup' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              Setup
            </button>
            <button
              onClick={() => setProgressStep('review')}
              className={`px-3 py-1 rounded text-sm ${progressStep === 'review' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              Review
            </button>
            <button
              onClick={() => setProgressStep('payment')}
              className={`px-3 py-1 rounded text-sm ${progressStep === 'payment' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              Payment
            </button>
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <CoverageProgress current={progressStep} />
          </div>
        </section>

        {/* 3. CitiesPanel */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">3. CitiesPanel (groupBy=metro)</h2>
          <CitiesPanel
            allCities={mockCities}
            selected={selectedCities}
            onChange={setSelectedCities}
            groupBy="metro"
          />
        </section>

        {/* 4. BundlesPanel */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">4. BundlesPanel</h2>
          <BundlesPanel
            bundles={mockBundles}
            selectedCities={selectedCities}
            onAddBundle={handleAddBundle}
          />
        </section>

        {/* 5. NeighborhoodsPanel */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">5. NeighborhoodsPanel (live search: state=AZ)</h2>
          <NeighborhoodsPanel
            state="AZ"
            selectedNeighborhoods={selectedNeighborhoods}
            onAdd={handleAddNeighborhood}
            onRemove={handleRemoveNeighborhood}
          />
        </section>

        {/* 6 & 7. Summary Components Side by Side */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">6. CoverageSummaryCard (Desktop)</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-4 border rounded-lg bg-muted/30">
              <p className="text-muted-foreground text-sm">[Main content area - summary card is sticky on right]</p>
            </div>
            <div>
              <CoverageSummaryCard
                selectedCities={selectedCities}
                cityNames={mockCityNames}
                selectedNeighborhoods={selectedNeighborhoods}
                subtotalMonthly={subtotalMonthly}
                onContinue={() => alert('Continue clicked!')}
              />
            </div>
          </div>
        </section>

        {/* 8. ReviewSummaryCard */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">8. ReviewSummaryCard</h2>
          <ReviewSummaryCard
            selectedCities={selectedCities}
            cityNames={mockCityNames}
            selectedNeighborhoods={selectedNeighborhoods}
            serverQuote={mockQuote}
            isLoadingQuote={false}
          />
        </section>

        {/* Mobile Footer Note */}
        <section className="space-y-4 pb-32">
          <h2 className="text-xl font-semibold border-b pb-2">7. CoverageSummaryFooter (Mobile)</h2>
          <p className="text-muted-foreground">
            ↓ The mobile footer is fixed at the bottom. Tap it to expand the drawer.
          </p>
        </section>
      </div>

      {/* Mobile Footer - always visible for testing */}
      <div className="lg:hidden">
        <CoverageSummaryFooter
          selectedCities={selectedCities}
          cityNames={mockCityNames}
          selectedNeighborhoods={selectedNeighborhoods}
          subtotalMonthly={subtotalMonthly}
          onContinue={() => alert('Review clicked!')}
        />
      </div>
    </div>
  );
}
