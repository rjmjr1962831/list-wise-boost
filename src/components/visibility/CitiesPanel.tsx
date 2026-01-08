import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CityOption {
  id: string;
  name: string;
  slug: string;
  county?: string;
  metro?: string;
}

interface CitiesPanelProps {
  allCities: CityOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  groupBy?: 'metro' | 'county' | 'none';
}

export function CitiesPanel({
  allCities,
  selected,
  onChange,
  groupBy = 'none',
}: CitiesPanelProps) {
  const [query, setQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Filter cities by search query
  const filteredCities = useMemo(() => {
    if (!query.trim()) return allCities;
    const lower = query.toLowerCase();
    return allCities.filter(
      (city) =>
        city.name.toLowerCase().includes(lower) ||
        city.county?.toLowerCase().includes(lower) ||
        city.metro?.toLowerCase().includes(lower)
    );
  }, [allCities, query]);

  // Group cities if needed
  const groupedCities = useMemo(() => {
    if (groupBy === 'none') {
      return { '': filteredCities };
    }
    const groups: Record<string, CityOption[]> = {};
    filteredCities.forEach((city) => {
      const key = (groupBy === 'metro' ? city.metro : city.county) || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(city);
    });
    return groups;
  }, [filteredCities, groupBy]);

  const toggleCity = (cityId: string) => {
    const next = new Set(selected);
    if (next.has(cityId)) {
      next.delete(cityId);
    } else {
      next.add(cityId);
    }
    onChange(next);
  };

  const selectAllVisible = () => {
    const next = new Set(selected);
    filteredCities.forEach((city) => next.add(city.id));
    onChange(next);
  };

  const clearAll = () => {
    onChange(new Set());
  };

  const toggleGroup = (groupName: string) => {
    const next = new Set(expandedGroups);
    if (next.has(groupName)) {
      next.delete(groupName);
    } else {
      next.add(groupName);
    }
    setExpandedGroups(next);
  };

  const sortedGroupNames = Object.keys(groupedCities).sort();

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Cities</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            Free
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {selected.size} cities selected
        </span>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search cities..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
        <Button variant="ghost" size="sm" onClick={selectAllVisible}>
          Select All Visible
        </Button>
        <span className="text-muted-foreground">|</span>
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear All
        </Button>
      </div>

      {/* City list */}
      <div className="max-h-80 overflow-y-auto">
        {sortedGroupNames.map((groupName) => {
          const cities = groupedCities[groupName];
          const isExpanded = groupBy === 'none' || expandedGroups.has(groupName);

          return (
            <div key={groupName || 'all'}>
              {groupBy !== 'none' && groupName && (
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-muted/30 hover:bg-muted/50 text-sm font-medium"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  {groupName}
                  <span className="text-muted-foreground">({cities.length})</span>
                </button>
              )}
              {isExpanded && (
                <div className="divide-y">
                  {cities.map((city) => (
                    <label
                      key={city.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 hover:bg-muted/50 cursor-pointer',
                        groupBy !== 'none' && 'pl-8'
                      )}
                    >
                      <Checkbox
                        checked={selected.has(city.id)}
                        onCheckedChange={() => toggleCity(city.id)}
                      />
                      <span className="text-sm">{city.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filteredCities.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No cities found
          </div>
        )}
      </div>
    </div>
  );
}
