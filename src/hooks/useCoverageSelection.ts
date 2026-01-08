import { useState, useCallback, useMemo } from 'react';
import type { SelectedNeighborhood, CoverageSelection } from '@/types/neighborhoodPricing';

interface UseCoverageSelectionReturn {
  // Cities (free)
  selectedCityIds: Set<string>;
  addCity: (cityId: string) => void;
  removeCity: (cityId: string) => void;
  addCities: (cityIds: string[]) => void;
  clearCities: () => void;
  
  // Neighborhoods (paid)
  selectedNeighborhoods: SelectedNeighborhood[];
  addNeighborhood: (n: SelectedNeighborhood) => void;
  removeNeighborhood: (neighborhoodId: string) => void;
  clearNeighborhoods: () => void;
  
  // Computed
  cityCount: number;
  neighborhoodCount: number;
  subtotalMonthly: number;
  
  // Serialization
  getSelection: () => CoverageSelection;
  loadSelection: (selection: CoverageSelection) => void;
  
  // Reset
  clearAll: () => void;
}

export function useCoverageSelection(): UseCoverageSelectionReturn {
  const [selectedCityIds, setSelectedCityIds] = useState<Set<string>>(new Set());
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<SelectedNeighborhood[]>([]);

  // City operations
  const addCity = useCallback((cityId: string) => {
    setSelectedCityIds(prev => new Set([...prev, cityId]));
  }, []);

  const removeCity = useCallback((cityId: string) => {
    setSelectedCityIds(prev => {
      const next = new Set(prev);
      next.delete(cityId);
      return next;
    });
  }, []);

  const addCities = useCallback((cityIds: string[]) => {
    setSelectedCityIds(prev => new Set([...prev, ...cityIds]));
  }, []);

  const clearCities = useCallback(() => {
    setSelectedCityIds(new Set());
  }, []);

  // Neighborhood operations
  const addNeighborhood = useCallback((neighborhood: SelectedNeighborhood) => {
    setSelectedNeighborhoods(prev => {
      // Prevent duplicates by ID
      if (prev.some(n => n.id === neighborhood.id)) {
        return prev;
      }
      return [...prev, neighborhood];
    });
  }, []);

  const removeNeighborhood = useCallback((neighborhoodId: string) => {
    setSelectedNeighborhoods(prev => prev.filter(n => n.id !== neighborhoodId));
  }, []);

  const clearNeighborhoods = useCallback(() => {
    setSelectedNeighborhoods([]);
  }, []);

  // Computed values
  const cityCount = useMemo(() => selectedCityIds.size, [selectedCityIds]);
  const neighborhoodCount = useMemo(() => selectedNeighborhoods.length, [selectedNeighborhoods]);
  
  const subtotalMonthly = useMemo(() => {
    return selectedNeighborhoods.reduce((sum, n) => sum + n.price_monthly, 0);
  }, [selectedNeighborhoods]);

  // Serialization
  const getSelection = useCallback((): CoverageSelection => {
    return {
      selectedCityIds: Array.from(selectedCityIds),
      selectedNeighborhoods
    };
  }, [selectedCityIds, selectedNeighborhoods]);

  const loadSelection = useCallback((selection: CoverageSelection) => {
    setSelectedCityIds(new Set(selection.selectedCityIds || []));
    setSelectedNeighborhoods(selection.selectedNeighborhoods || []);
  }, []);

  // Reset all
  const clearAll = useCallback(() => {
    setSelectedCityIds(new Set());
    setSelectedNeighborhoods([]);
  }, []);

  return {
    // Cities
    selectedCityIds,
    addCity,
    removeCity,
    addCities,
    clearCities,
    
    // Neighborhoods
    selectedNeighborhoods,
    addNeighborhood,
    removeNeighborhood,
    clearNeighborhoods,
    
    // Computed
    cityCount,
    neighborhoodCount,
    subtotalMonthly,
    
    // Serialization
    getSelection,
    loadSelection,
    
    // Reset
    clearAll
  };
}
