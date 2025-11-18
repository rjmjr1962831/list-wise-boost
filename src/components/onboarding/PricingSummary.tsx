import React from "react";
import { Card } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

interface PricingSummaryProps {
  data: any;
}

const PricingSummary = ({ data }: PricingSummaryProps) => {
  const calculateCosts = () => {
    let total = 0;
    const breakdown: Array<{ item: string; cost: number }> = [];

    const citiesArray = Array.isArray(data?.cities) ? data.cities : [];
    const specialtiesArray = Array.isArray(data?.specialties) ? data.specialties : [];
    const zipCodesArray = Array.isArray(data?.zipCodes) ? data.zipCodes : [];

    // Cities: first free, then charged (example: $20/month per additional city)
    if (citiesArray.length > 1) {
      const additionalCities = citiesArray.length - 1;
      const cityCost = additionalCities * 20;
      breakdown.push({ item: `${additionalCities} Additional Cities`, cost: cityCost });
      total += cityCost;
    }

    // Specialties: first 2 free, then $25/month each
    if (specialtiesArray.length > 2) {
      const additionalSpecialties = specialtiesArray.length - 2;
      const specialtyCost = additionalSpecialties * 25;
      breakdown.push({ item: `${additionalSpecialties} Additional Specialties`, cost: specialtyCost });
      total += specialtyCost;
    }

    // Zip codes: first 2 free, then tiered pricing based on rating
    if (zipCodesArray.length > 2) {
      const additionalZips = zipCodesArray.slice(2);
      let zipCost = 0;
      additionalZips.forEach((zip: any) => {
        const cost = zip.rating <= 2 ? 10 : zip.rating === 3 ? 20 : zip.rating === 4 ? 30 : 50;
        zipCost += cost;
      });
      breakdown.push({ item: `${additionalZips.length} Additional Zip Codes`, cost: zipCost });
      total += zipCost;
    }

    return { total, breakdown };
  };

  const { total, breakdown } = calculateCosts();
  const citiesArray = Array.isArray(data?.cities) ? data.cities : [];
  const specialtiesArray = Array.isArray(data?.specialties) ? data.specialties : [];
  const zipCodesArray = Array.isArray(data?.zipCodes) ? data.zipCodes : [];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-lg">Pricing Summary</h3>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Base Listing</span>
          <span className="font-medium text-green-600">FREE</span>
        </div>

        {citiesArray.length > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">First City</span>
            <span className="font-medium text-green-600">FREE</span>
          </div>
        )}

        {specialtiesArray.length > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">First 2 Specialties</span>
            <span className="font-medium text-green-600">FREE</span>
          </div>
        )}

        {zipCodesArray.length > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">First 2 Zip Codes</span>
            <span className="font-medium text-green-600">FREE</span>
          </div>
        )}

        {breakdown.length > 0 && (
          <>
            <div className="border-t pt-3 mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">ADDITIONAL CHARGES</p>
              {breakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm mb-2">
                  <span className="text-muted-foreground">{item.item}</span>
                  <span className="font-medium">${item.cost}/mo</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="border-t pt-3 mt-3">
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg">Total Monthly Cost</span>
            <span className="font-bold text-2xl text-primary">${total}</span>
          </div>
        </div>

        {total === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
            <p className="text-sm text-green-800 font-medium text-center">
              🎉 Your listing is FREE!
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default PricingSummary;
