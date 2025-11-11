// Utility to generate professional data for a city/category combination

interface GeneratedProfessional {
  name: string;
  category_id: string;
  city_id: string;
  rank: number;
  type: string;
  specialty: string[];
  years_experience: number;
  badges: string[];
  title: string;
  email: string;
  phone: string;
  website: string;
  description: string;
  image_url: string;
  active: boolean;
}

const firstNames = [
  'Jennifer', 'Michael', 'Sarah', 'David', 'Lisa', 'Robert', 'Emily', 'James',
  'Amanda', 'Christopher', 'Jessica', 'Matthew', 'Ashley', 'Daniel', 'Michelle',
  'Andrew', 'Stephanie', 'Joshua', 'Nicole', 'Ryan'
];

const lastNames = [
  'Anderson', 'Johnson', 'Williams', 'Brown', 'Martinez', 'Garcia', 'Rodriguez',
  'Wilson', 'Moore', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
  'Thompson', 'Lee', 'Walker', 'Hall', 'Allen'
];

const realEstateSpecialties = [
  ['Luxury Homes', 'Investment Properties', 'First-Time Buyers'],
  ['Family Homes', 'Relocation', 'Downsizing'],
  ['New Construction', 'Modern Homes', 'Tech-Savvy Marketing'],
  ['Investment Properties', 'Multi-Family', 'Commercial'],
  ['Probate', 'Estate Sales', 'Senior Housing'],
  ['First-Time Buyers', 'Condos', 'Affordable Housing'],
  ['Bilingual Services', 'Hispanic Community', 'Family Homes'],
  ['Short Sales', 'Foreclosures', 'Distressed Properties'],
  ['Young Professionals', 'Urban Living', 'Downtown Areas'],
  ['Eco-Friendly Homes', 'Sustainable Living', 'Green Certifications']
];

const realEstateTitles = [
  'Senior Real Estate Advisor',
  'Real Estate Broker',
  'Associate Broker',
  'Real Estate Investment Advisor',
  'Senior Specialist Realtor',
  'Real Estate Agent',
  'Bilingual Real Estate Agent',
  'Short Sale Specialist',
  'Urban Lifestyle Agent',
  'Eco-Specialist Realtor'
];

const realEstateBadges = [
  ['Top Producer 2024', 'Luxury Specialist'],
  ['Client Satisfaction Award', 'Community Champion'],
  ['Innovation Award', 'Digital Marketing Expert'],
  ['Investment Specialist', 'Top Sales 2024'],
  ['Certified Probate Expert', 'Senior Real Estate Specialist'],
  ['Rising Star 2024', 'First-Time Buyer Champion'],
  ['Community Leader', 'Bilingual Expert'],
  ['Negotiation Expert', 'Quick Closer'],
  ['Social Media Star', 'Millennial Choice'],
  ['Green Home Certified', 'Sustainability Advocate']
];

function generatePhoneNumber(cityAreaCode: string): string {
  const exchange = Math.floor(Math.random() * 900) + 100;
  const lineNumber = Math.floor(Math.random() * 9000) + 1000;
  return `(${cityAreaCode}) ${exchange}-${lineNumber}`;
}

function generateEmail(firstName: string, lastName: string): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${lastName.toLowerCase()}realty.com`;
}

function generateWebsite(firstName: string, lastName: string): string {
  return `https://${firstName.toLowerCase()}${lastName.toLowerCase()}.com`;
}

export function generateRealEstateAgents(
  cityId: string,
  cityName: string,
  categoryId: string,
  areaCode: string = '555'
): GeneratedProfessional[] {
  const professionals: GeneratedProfessional[] = [];
  
  for (let i = 0; i < 10; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const name = `${firstName} ${lastName}`;
    const type = i < 5 ? 'established' : 'emerging';
    const yearsExp = type === 'established' ? 12 + Math.floor(Math.random() * 8) : 3 + Math.floor(Math.random() * 4);
    
    professionals.push({
      name,
      category_id: categoryId,
      city_id: cityId,
      rank: i + 1,
      type,
      specialty: realEstateSpecialties[i],
      years_experience: yearsExp,
      badges: realEstateBadges[i],
      title: realEstateTitles[i],
      email: generateEmail(firstName, lastName),
      phone: generatePhoneNumber(areaCode),
      website: generateWebsite(firstName, lastName),
      description: `Experienced real estate professional serving ${cityName} with ${yearsExp} years of expertise. Specializing in ${realEstateSpecialties[i].slice(0, 2).join(' and ')}.`,
      image_url: '/api/placeholder/400/400',
      active: true
    });
  }
  
  return professionals;
}

export function generateProfessionals(
  cityId: string,
  cityName: string,
  categoryId: string,
  categorySlug: string,
  areaCode: string = '555'
): GeneratedProfessional[] {
  // For now, only support real estate agents
  // Can be extended for other categories
  if (categorySlug === 'top10realestateagents') {
    return generateRealEstateAgents(cityId, cityName, categoryId, areaCode);
  }
  
  return [];
}
