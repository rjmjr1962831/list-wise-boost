import { Professional } from '@/types/professional';
import jenniferWalsh from '@/assets/realtors/jennifer-walsh.jpg';
import robertAnderson from '@/assets/realtors/robert-anderson.jpg';
import davidKim from '@/assets/realtors/david-kim.jpg';
import sarahJohnson from '@/assets/realtors/sarah-johnson.jpg';
import michaelTorres from '@/assets/realtors/michael-torres.jpg';
import heatherMarlowe from '@/assets/realtors/heather-marlowe.jpg';
import ashleyPickens from '@/assets/realtors/ashley-pickens.jpg';
import lisaBrown from '@/assets/realtors/lisa-brown.jpg';
import christinaMartinez from '@/assets/realtors/christina-martinez.jpg';
import zacharyCates from '@/assets/realtors/zachary-cates.jpg';

export const anaheimRealEstateAgents: Professional[] = [
  {
    rank: 1,
    name: 'Jennifer Walsh',
    company: 'Anaheim Elite Realty',
    rating: 5.0,
    reviews: 182,
    specialties: ['Luxury Homes', 'Single Family', 'Over 1.5M', 'Investment Properties'],
    address: '201 W Center St Promenade, Anaheim, CA 92805',
    phone: '(714) 555-2101',
    email: 'jwalsh@anaheimeliterealty.com',
    website: 'https://jenniferwalshrealty.com',
    description: 'Top producer specializing in Anaheim Hills and Orange County luxury markets with white-glove service.',
    verified: true,
    image: jenniferWalsh,
    stats: { salesLast12Mo: 48000000, yearsExperience: 14 }
  },
  {
    rank: 2,
    name: 'Robert Anderson',
    company: 'Anderson & Co. Real Estate',
    rating: 4.9,
    reviews: 167,
    specialties: ['Estate Sales', 'Senior Housing', 'Probate'],
    address: '510 S Brookhurst St, Anaheim, CA 92804',
    phone: '(714) 555-2102',
    email: 'robert@andersonandco.com',
    website: 'https://robertandersonhomes.com',
    description: 'Compassionate expert for probate and senior transitions with 20+ years experience.',
    verified: true,
    image: robertAnderson,
    stats: { salesLast12Mo: 36000000, yearsExperience: 20 }
  },
  {
    rank: 3,
    name: 'David Kim',
    company: 'OC Modern Homes',
    rating: 4.9,
    reviews: 149,
    specialties: ['New Construction', 'Modern Homes', 'Tech-Savvy Marketing'],
    address: '2400 E Katella Ave, Anaheim, CA 92806',
    phone: '(714) 555-2103',
    email: 'david@ocmodernhomes.com',
    website: 'https://davidkimhomes.com',
    description: 'Bringing cutting-edge marketing and analytics to Anaheim new construction and modern homes.',
    verified: true,
    image: davidKim,
    stats: { salesLast12Mo: 32000000, yearsExperience: 12 }
  },
  {
    rank: 4,
    name: 'Sarah Johnson',
    company: 'Citrus Grove Realty',
    rating: 4.8,
    reviews: 131,
    specialties: ['Family Homes', 'Relocation', 'Schools & Neighborhoods'],
    address: '1800 W Lincoln Ave, Anaheim, CA 92801',
    phone: '(714) 555-2104',
    email: 'sarah@citrusgroverealty.com',
    website: 'https://sarahjohnsonre.com',
    description: 'Trusted local expert for families relocating to Anaheim and surrounding communities.',
    verified: true,
    image: sarahJohnson,
    stats: { salesLast12Mo: 28000000, yearsExperience: 9 }
  },
  {
    rank: 5,
    name: 'Michael Torres',
    company: 'Torres Property Group',
    rating: 4.8,
    reviews: 118,
    specialties: ['Investment Properties', 'Multi-Family', '1031 Exchange'],
    address: '1325 E La Palma Ave, Anaheim, CA 92805',
    phone: '(714) 555-2105',
    email: 'michael@torrespg.com',
    website: 'https://michaeltorresrealty.com',
    description: 'Investor-focused agent with deep expertise in Anaheim multi-family and cash-flow analysis.',
    verified: true,
    image: michaelTorres,
    stats: { salesLast12Mo: 30000000, yearsExperience: 11 }
  },
  {
    rank: 6,
    name: 'Heather Marlowe',
    company: 'Marlowe Residential',
    rating: 4.7,
    reviews: 102,
    specialties: ['First-Time Buyers', 'Condos', 'Under 500K'],
    address: '700 E South St, Anaheim, CA 92805',
    phone: '(714) 555-2106',
    email: 'heather@marloweresidential.com',
    website: 'https://heathermarlowe.com',
    description: 'Patient, education-first guidance for first-time buyers and condo seekers.',
    verified: true,
    image: heatherMarlowe,
    stats: { yearsExperience: 6 }
  },
  {
    rank: 7,
    name: 'Ashley Pickens',
    company: 'Pickens Realty Collective',
    rating: 4.7,
    reviews: 96,
    specialties: ['Bilingual Services', 'Family Homes', 'Community Involvement'],
    address: '2525 E Ball Rd, Anaheim, CA 92806',
    phone: '(714) 555-2107',
    email: 'ashley@pickenscollective.com',
    website: 'https://ashleypickens.com',
    description: 'Community-focused agent offering bilingual support and neighborhood insight.',
    verified: true,
    image: ashleyPickens,
    stats: { yearsExperience: 5 }
  },
  {
    rank: 8,
    name: 'Lisa Brown',
    company: 'West Orange Properties',
    rating: 4.6,
    reviews: 88,
    specialties: ['Townhomes', 'Entry-Level', 'Under 500K'],
    address: '1221 N Euclid St, Anaheim, CA 92801',
    phone: '(714) 555-2108',
    email: 'lisa@westorangeprop.com',
    website: 'https://lisabrownhomes.com',
    description: 'Helping buyers win in competitive entry-level price points across Anaheim.',
    verified: true,
    image: lisaBrown,
    stats: { yearsExperience: 7 }
  },
  {
    rank: 9,
    name: 'Christina Martinez',
    company: 'Martinez & Partners',
    rating: 4.6,
    reviews: 81,
    specialties: ['New Builds', 'Suburbs', '500K to 1.5M'],
    address: '950 S Euclid St, Anaheim, CA 92802',
    phone: '(714) 555-2109',
    email: 'christina@martinezpartners.com',
    website: 'https://christinamartinezre.com',
    description: 'Guiding families to new-build communities and amenity-rich neighborhoods.',
    verified: true,
    image: christinaMartinez,
    stats: { yearsExperience: 6 }
  },
  {
    rank: 10,
    name: 'Zachary Cates',
    company: 'Cates Home Advisors',
    rating: 4.6,
    reviews: 75,
    specialties: ['Urban Living', 'Downtown Anaheim', 'Condo'],
    address: '205 W Center Street Promenade, Anaheim, CA 92805',
    phone: '(714) 555-2110',
    email: 'zach@catesadvisors.com',
    website: 'https://zacharycates.com',
    description: 'Downtown Anaheim specialist for walkable-lifestyle condo and loft buyers.',
    verified: true,
    image: zacharyCates,
    stats: { yearsExperience: 4 }
  }
];
