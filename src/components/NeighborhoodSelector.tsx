import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getZipCodesByCity } from '@/data/zipCodeLookup';

interface Neighborhood {
  suburb: string;
  zipcodes: string[];
}

interface NeighborhoodSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cityName: string;
  stateName: string;
  onConfirm: (selectedNeighborhoods: string[]) => void;
}

export function NeighborhoodSelector({
  open,
  onOpenChange,
  cityName,
  stateName,
  onConfirm
}: NeighborhoodSelectorProps) {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);

  useEffect(() => {
    if (open && cityName && stateName) {
      // Fetch zip codes for this city
      const zipCodes = getZipCodesByCity(cityName, stateName);
      
      // Group by suburb
      const suburbMap = new Map<string, string[]>();
      zipCodes.forEach(zip => {
        if (!suburbMap.has(zip.suburb)) {
          suburbMap.set(zip.suburb, []);
        }
        suburbMap.get(zip.suburb)!.push(zip.zipcode);
      });

      // Convert to array
      const neighborhoodList: Neighborhood[] = Array.from(suburbMap.entries()).map(([suburb, zipcodes]) => ({
        suburb,
        zipcodes
      }));

      setNeighborhoods(neighborhoodList);
      
      // Select all by default
      setSelectedNeighborhoods(new Set(neighborhoodList.map(n => n.suburb)));
      setSelectAll(true);
    }
  }, [open, cityName, stateName]);

  const handleToggleAll = () => {
    if (selectAll) {
      // Deselect all
      setSelectedNeighborhoods(new Set());
      setSelectAll(false);
    } else {
      // Select all
      setSelectedNeighborhoods(new Set(neighborhoods.map(n => n.suburb)));
      setSelectAll(true);
    }
  };

  const handleToggleNeighborhood = (suburb: string) => {
    const newSelected = new Set(selectedNeighborhoods);
    if (newSelected.has(suburb)) {
      newSelected.delete(suburb);
    } else {
      newSelected.add(suburb);
    }
    setSelectedNeighborhoods(newSelected);
    setSelectAll(newSelected.size === neighborhoods.length);
  };

  const handleConfirm = () => {
    const selected = selectAll ? [] : Array.from(selectedNeighborhoods);
    onConfirm(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Any Neighborhoods In Particular?</DialogTitle>
          <DialogDescription>
            Select specific neighborhoods in {cityName}, {stateName} or choose all
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Select All Option */}
          <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg border-2 border-primary/20">
            <Checkbox
              id="select-all"
              checked={selectAll}
              onCheckedChange={handleToggleAll}
              className="h-5 w-5"
            />
            <label
              htmlFor="select-all"
              className="text-base font-semibold cursor-pointer flex-1"
            >
              All Neighborhoods
            </label>
          </div>

          {/* Neighborhood List */}
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-2">
              {neighborhoods.map((neighborhood) => (
                <div
                  key={neighborhood.suburb}
                  className="flex items-center space-x-3 p-3 hover:bg-muted/50 rounded-md transition-colors"
                >
                  <Checkbox
                    id={neighborhood.suburb}
                    checked={selectedNeighborhoods.has(neighborhood.suburb)}
                    onCheckedChange={() => handleToggleNeighborhood(neighborhood.suburb)}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor={neighborhood.suburb}
                    className="text-sm cursor-pointer flex-1"
                  >
                    <span className="font-medium">{neighborhood.suburb}</span>
                    <span className="text-muted-foreground ml-2">
                      ({neighborhood.zipcodes.length} zip code{neighborhood.zipcodes.length !== 1 ? 's' : ''})
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1"
              disabled={!selectAll && selectedNeighborhoods.size === 0}
            >
              Continue with {selectAll ? 'All' : selectedNeighborhoods.size} Neighborhood{(!selectAll && selectedNeighborhoods.size !== 1) ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
