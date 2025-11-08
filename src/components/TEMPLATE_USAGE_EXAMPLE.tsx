/**
 * TEMPLATE USAGE EXAMPLE
 * 
 * This file demonstrates how to use the professional list templates
 * to quickly create new professional listing pages.
 * 
 * Follow these steps:
 * 1. Define your professionals data array
 * 2. Configure page metadata
 * 3. Split professionals into sections (optional)
 * 4. Use ProfessionalListLayout and CollapsibleListSection components
 */

import { ProfessionalListLayout } from "@/components/ProfessionalListLayout";
import { CollapsibleListSection } from "@/components/CollapsibleListSection";
import { Professional, PageMetadata, ListSection } from "@/types/professional";

// Step 1: Define your professionals data
// Import images as needed
import exampleImg from "@/assets/dentists/sarah-mitchell.jpg";

const professionals: Professional[] = [
  {
    rank: 1,
    name: "Example Professional",
    title: "DDS", // Optional, e.g., "DDS", "MD", etc.
    company: "Example Practice/Brokerage",
    rating: 4.9,
    reviews: 342,
    specialties: ["Specialty 1", "Specialty 2", "Specialty 3"],
    address: "123 Main St, Gilbert, AZ 85295",
    phone: "(480) 555-0100",
    website: "example.com",
    description: "Brief description highlighting achievements and expertise.",
    stats: {
      // Customize stats based on profession
      yearsExperience: 15,
      patientsServed: 5000,
      successRate: "98%",
      // For realtors: salesLast12Mo, saleToListRatio, avgDaysOnMarket
    },
    verified: true,
    image: exampleImg
  },
  // Add more professionals...
];

// Step 2: Configure page metadata
const pageMetadata: PageMetadata = {
  title: "Top 10 [Profession] in [City], [State] (2025)",
  description: "Discover the top [profession] in [City]. Verified professionals with proven records, client reviews, and local expertise.",
  breadcrumbs: [
    { name: "Arizona" },
    { name: "Gilbert" },
    { name: "Top [Profession]" }
  ],
  location: {
    city: "Gilbert",
    state: "Arizona",
    stateAbbr: "AZ"
  },
  profession: {
    singular: "Dentist", // or "Real Estate Agent", "Lawyer", etc.
    plural: "Dentists", // or "Real Estate Agents", "Lawyers", etc.
    schemaType: "Dentist" // Schema.org type: "Dentist", "RealEstateAgent", "Attorney", etc.
  }
};

// Step 3: Split professionals into sections (optional)
const sections: ListSection[] = [
  {
    title: "Established Leaders",
    description: "Proven track records with years of excellence",
    accentColor: "primary",
    items: professionals.slice(0, 5)
  },
  {
    title: "Hungry & Hustling",
    description: "Rising stars with exceptional client service",
    accentColor: "sunset-orange",
    items: professionals.slice(5, 10)
  }
];

// Step 4: Use the templates in your page component
const ExampleProfessionalList = () => {
  return (
    <ProfessionalListLayout
      metadata={pageMetadata}
      professionals={professionals}
    >
      {/* Render sections */}
      {sections.map((section, index) => (
        <CollapsibleListSection
          key={section.title}
          section={section}
          defaultOpen={index === 0} // First section open by default
          schemaType={pageMetadata.profession.schemaType}
        />
      ))}
      
      {/* OR: Render all professionals without collapsible sections */}
      {/* 
      {professionals.map((professional) => (
        <ProfessionalCard 
          key={professional.rank}
          professional={professional}
          schemaType={pageMetadata.profession.schemaType}
        />
      ))}
      */}
    </ProfessionalListLayout>
  );
};

export default ExampleProfessionalList;

/**
 * QUICK START CHECKLIST:
 * 
 * ✓ Import professional images to src/assets/[profession-type]/
 * ✓ Copy this template to src/pages/YourNewList.tsx
 * ✓ Update professionals array with your data
 * ✓ Configure pageMetadata for your location/profession
 * ✓ Adjust sections if using collapsible layout
 * ✓ Add route to src/App.tsx
 * ✓ Update tailwind.config.ts if adding new accent colors
 * 
 * AVAILABLE ACCENT COLORS:
 * - primary (blue/teal)
 * - sunset-orange
 * - terracotta
 * - turquoise
 * - cactus-green
 * - desert-sand
 */
