import { Professional } from '@/types/professional';

// Phoenix, Arizona - Sample Data for All Categories

export const phoenixDentists: Professional[] = [
  {
    rank: 1,
    name: "Dr. Sarah Chen",
    company: "Phoenix Premier Dental",
    rating: 4.9,
    reviews: 342,
    specialties: ["Cosmetic Dentistry", "Implants", "Emergency Care"],
    address: "1234 N Central Ave, Phoenix, AZ 85004",
    phone: "(602) 555-0101",
    website: "https://phoenixpremierdental.com",
    description: "Award-winning cosmetic and restorative dentistry with state-of-the-art technology.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { patientsServed: 5000, yearsExperience: 15 }
  },
  {
    rank: 2,
    name: "Dr. Michael Rodriguez",
    company: "Desert Dental Care",
    rating: 4.8,
    reviews: 289,
    specialties: ["Family Dentistry", "Orthodontics", "Pediatrics"],
    address: "5678 E Camelback Rd, Phoenix, AZ 85018",
    phone: "(602) 555-0102",
    website: "https://desertdentalcare.com",
    description: "Comprehensive family dental care serving Phoenix for over 20 years.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { patientsServed: 8000, yearsExperience: 20 }
  }
];

export const phoenixRealtors: Professional[] = [
  {
    rank: 1,
    name: "Jennifer Martinez",
    company: "Sonoran Realty Group",
    rating: 5.0,
    reviews: 156,
    specialties: ["Luxury Homes", "Single Family", "Over 1.5M", "Investment Properties"],
    address: "2100 N Central Ave, Phoenix, AZ 85004",
    phone: "(602) 555-0201",
    website: "https://sonoranrealty.com",
    description: "$50M+ in sales. Expert in Phoenix luxury market and investment properties.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { salesLast12Mo: 52000000, yearsExperience: 12 },
    testimonials: [
      {
        author: "Michael & Sarah T.",
        text: "Jennifer made our luxury home purchase completely stress-free. Her knowledge of the Paradise Valley market is unmatched, and she negotiated an amazing deal for us. We saved over $100K thanks to her expertise and connections. She was always available to answer questions and guided us through every step with patience and professionalism.",
        source: "Zillow",
        date: "January 2025"
      },
      {
        author: "Robert Chen",
        text: "As an out-of-state investor, I needed someone I could trust completely. Jennifer exceeded all expectations. She found us three investment properties that are already generating positive cash flow. Her market analysis was spot-on and she has a great network of property managers and contractors.",
        source: "Google Reviews",
        date: "December 2024"
      },
      {
        author: "Amanda Rodriguez",
        text: "Working with Jennifer was the best decision we made! She sold our previous home for $50K over asking in just 5 days, then helped us find our dream home in Arcadia. Her staging recommendations and marketing strategy were incredible. Jennifer truly goes above and beyond for her clients.",
        source: "Realtor.com",
        date: "November 2024"
      }
    ]
  },
  {
    rank: 2,
    name: "David Thompson",
    company: "Valley Home Experts",
    rating: 4.9,
    reviews: 201,
    specialties: ["Relocation", "Single Family", "500K to 1.5M", "New Construction"],
    address: "3456 E Indian School Rd, Phoenix, AZ 85018",
    phone: "(602) 555-0202",
    website: "https://valleyhomeexperts.com",
    description: "Relocation specialist helping families transition to the Phoenix area.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { salesLast12Mo: 38000000, yearsExperience: 9 },
    testimonials: [
      {
        author: "The Johnson Family",
        text: "Relocating from Chicago was daunting, but David made it seamless. He sent us video tours of homes, coordinated everything remotely, and even recommended great schools and neighborhoods for our kids. We closed on our perfect home in Chandler without any stress. David is simply the best relocation specialist in the Valley!",
        source: "Yelp",
        date: "February 2025"
      },
      {
        author: "Lisa Patterson",
        text: "David's knowledge of new construction communities is exceptional. He walked us through the entire build process, attended meetings with the builder, and caught several issues during inspections that saved us thousands. His attention to detail and commitment to his clients is remarkable.",
        source: "Google Reviews", 
        date: "January 2025"
      },
      {
        author: "Mark & Jennifer W.",
        text: "We interviewed five realtors before choosing David, and we are so glad we did. He understood exactly what we wanted and showed us only homes that fit our criteria. His negotiation skills got us $15K in closing cost credits. Professional, responsive, and genuinely cares about his clients.",
        source: "Facebook",
        date: "December 2024"
      }
    ]
  },
  {
    rank: 3,
    name: "Emily Chen",
    company: "Downtown Phoenix Living",
    rating: 4.8,
    reviews: 134,
    specialties: ["Condo", "Under 500K", "First-Time Buyers", "Urban Living"],
    address: "455 N 3rd St, Phoenix, AZ 85004",
    phone: "(602) 555-0203",
    website: "https://downtownphxliving.com",
    description: "Condo specialist helping first-time buyers find their perfect downtown home.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { salesLast12Mo: 18000000, yearsExperience: 7 },
    testimonials: [
      {
        author: "Jessica Martinez",
        text: "As a first-time homebuyer, I was overwhelmed by the process. Emily made everything easy to understand and never pressured me. She found me an amazing condo in Roosevelt Row within my budget and even connected me with a great lender who got me an incredible rate. Could not have done this without her!",
        source: "Zillow",
        date: "February 2025"
      },
      {
        author: "Alex Thompson",
        text: "Emily knows downtown Phoenix like no one else. She showed me condos I never would have found on my own and gave me insider info on upcoming developments and neighborhood trends. Her expertise helped me find an investment property that has already appreciated 12% in six months!",
        source: "Google Reviews",
        date: "January 2025"
      },
      {
        author: "Samantha & Chris L.",
        text: "We wanted urban living without breaking the bank. Emily found us the perfect loft in the Arts District with walkability to everything we love. She negotiated a great price and her recommendations for contractors helped us customize our space beautifully. Highly recommend!",
        source: "Realtor.com",
        date: "December 2024"
      }
    ]
  },
  {
    rank: 4,
    name: "Robert Williams",
    company: "Desert Land & Estates",
    rating: 4.9,
    reviews: 98,
    specialties: ["Land", "Single Family", "Over 1.5M", "Custom Builds"],
    address: "7890 E Shea Blvd, Phoenix, AZ 85260",
    phone: "(602) 555-0204",
    website: "https://desertlandestates.com",
    description: "Specializing in luxury land parcels and custom estate home sites.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { salesLast12Mo: 42000000, yearsExperience: 15 }
  },
  {
    rank: 5,
    name: "Lisa Rodriguez",
    company: "Valley Family Homes",
    rating: 4.7,
    reviews: 187,
    specialties: ["Single Family", "Under 500K", "First-Time Buyers", "FHA Loans"],
    address: "2345 W Baseline Rd, Phoenix, AZ 85041",
    phone: "(602) 555-0205",
    website: "https://valleyfamilyhomes.com",
    description: "Dedicated to helping families find affordable homes in great neighborhoods.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { salesLast12Mo: 22000000, yearsExperience: 11 }
  }
];

export const phoenixLawyers: Professional[] = [
  {
    rank: 1,
    name: "Robert Anderson",
    company: "Anderson & Associates Law",
    rating: 4.9,
    reviews: 127,
    specialties: ["Civil Litigation", "Contract Law", "Appeals"],
    address: "100 W Washington St, Phoenix, AZ 85003",
    phone: "(602) 555-0301",
    website: "https://andersonlawaz.com",
    description: "Board-certified attorney with 25 years experience in complex litigation.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { yearsExperience: 25 }
  }
];

export const phoenixPersonalInjuryLawyers: Professional[] = [
  {
    rank: 1,
    name: "Maria Sanchez",
    company: "Sanchez Personal Injury Law",
    rating: 5.0,
    reviews: 89,
    specialties: ["Car Accidents", "Slip & Fall", "Medical Malpractice"],
    address: "1800 N Central Ave, Phoenix, AZ 85004",
    phone: "(602) 555-0401",
    website: "https://sanchezinjurylaw.com",
    description: "$100M+ recovered for clients. No fees unless we win your case.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { yearsExperience: 18, successRate: "95%" }
  }
];

export const phoenixBusinessLawyers: Professional[] = [
  {
    rank: 1,
    name: "James Wilson",
    company: "Wilson Corporate Law",
    rating: 4.8,
    reviews: 73,
    specialties: ["Business Formation", "Contracts", "M&A"],
    address: "2600 N Central Ave, Phoenix, AZ 85004",
    phone: "(602) 555-0501",
    website: "https://wilsoncorporatelaw.com",
    description: "Helping startups and established businesses navigate complex corporate matters.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { yearsExperience: 16 }
  }
];

export const phoenixRealEstateLawyers: Professional[] = [
  {
    rank: 1,
    name: "Patricia Lee",
    company: "Lee Real Estate Law",
    rating: 4.9,
    reviews: 94,
    specialties: ["Closings", "Title Issues", "Commercial Real Estate"],
    address: "3200 N Central Ave, Phoenix, AZ 85012",
    phone: "(602) 555-0601",
    website: "https://leerealestatelaw.com",
    description: "Protecting your interests in residential and commercial real estate transactions.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { yearsExperience: 22 }
  }
];

export const phoenixRestaurants: Professional[] = [
  {
    rank: 1,
    name: "The Copper Cactus",
    company: "Fine Southwestern Dining",
    rating: 4.8,
    reviews: 856,
    specialties: ["Southwestern", "Steaks", "Craft Cocktails"],
    address: "4500 E Camelback Rd, Phoenix, AZ 85018",
    phone: "(602) 555-0701",
    website: "https://coppercactus.com",
    description: "Award-winning Southwestern cuisine with panoramic mountain views.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { yearsExperience: 12 }
  }
];

export const phoenixChineseRestaurants: Professional[] = [
  {
    rank: 1,
    name: "Golden Dragon",
    company: "Authentic Szechuan Cuisine",
    rating: 4.7,
    reviews: 423,
    specialties: ["Szechuan", "Dim Sum", "Hot Pot"],
    address: "8765 N 19th Ave, Phoenix, AZ 85021",
    phone: "(602) 555-0801",
    website: "https://goldendragonphx.com",
    description: "Family-owned restaurant serving authentic Chinese cuisine for 30 years.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { yearsExperience: 30 }
  }
];

export const phoenixPizzaRestaurants: Professional[] = [
  {
    rank: 1,
    name: "Valley Pizza Co.",
    company: "Wood-Fired Pizza",
    rating: 4.9,
    reviews: 678,
    specialties: ["Wood-Fired", "NY Style", "Craft Beer"],
    address: "2345 E Thomas Rd, Phoenix, AZ 85016",
    phone: "(602) 555-0901",
    website: "https://valleypizzaco.com",
    description: "Artisan pizzas made with locally-sourced ingredients and wood-fired ovens.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { yearsExperience: 8 }
  }
];

export const phoenixItalianRestaurants: Professional[] = [
  {
    rank: 1,
    name: "Bella Napoli",
    company: "Traditional Italian",
    rating: 4.8,
    reviews: 534,
    specialties: ["Pasta", "Risotto", "Wine Bar"],
    address: "5670 N 7th St, Phoenix, AZ 85014",
    phone: "(602) 555-1001",
    website: "https://bellanapoli.com",
    description: "Northern Italian cuisine with homemade pasta and extensive wine list.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { yearsExperience: 15 }
  }
];

export const phoenixSportsBars: Professional[] = [
  {
    rank: 1,
    name: "Champions Sports Grill",
    company: "Premier Sports Bar",
    rating: 4.6,
    reviews: 912,
    specialties: ["Game Day", "Wings", "Craft Beer"],
    address: "1234 E Indian School Rd, Phoenix, AZ 85014",
    phone: "(602) 555-1101",
    website: "https://championssportsgrill.com",
    description: "50+ HD TVs, outstanding wings, and the best game day atmosphere in Phoenix.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { yearsExperience: 10 }
  }
];

export const phoenixFancyRestaurants: Professional[] = [
  {
    rank: 1,
    name: "Elements",
    company: "Modern American Fine Dining",
    rating: 4.9,
    reviews: 287,
    specialties: ["Farm-to-Table", "Tasting Menu", "Wine Pairing"],
    address: "5532 N Palo Cristi Rd, Phoenix, AZ 85253",
    phone: "(602) 555-1201",
    website: "https://elementsphx.com",
    description: "Michelin-recommended restaurant featuring seasonal tasting menus and curated wine pairings.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { yearsExperience: 7 }
  }
];

export const phoenixCheapButGood: Professional[] = [
  {
    rank: 1,
    name: "Los Favoritos Taco Shop",
    company: "Authentic Mexican Street Food",
    rating: 4.8,
    reviews: 1243,
    specialties: ["Tacos", "Burritos", "Breakfast"],
    address: "3456 W McDowell Rd, Phoenix, AZ 85009",
    phone: "(602) 555-1301",
    website: "https://losfavoritostaco.com",
    description: "Award-winning street tacos and authentic Mexican food at unbeatable prices.",
    verified: true,
    image: "/api/placeholder/400/400",
    stats: { yearsExperience: 25 }
  }
];
