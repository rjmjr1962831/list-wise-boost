import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

const popularCities = [
  { name: 'Phoenix', slug: 'phoenix-az' },
  { name: 'Scottsdale', slug: 'scottsdale-az' },
  { name: 'Mesa', slug: 'mesa-az' },
  { name: 'Chandler', slug: 'chandler-az' },
  { name: 'Gilbert', slug: 'gilbert-az' },
  { name: 'Tempe', slug: 'tempe-az' },
  { name: 'Glendale', slug: 'glendale-az' },
  { name: 'Peoria', slug: 'peoria-az' },
];

export default function HeroSearch() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // Convert to slug format
      const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      navigate(`/arizona/${slug}/top-realtors`);
    }
  };
  
  return (
    <section className="bg-gradient-to-b from-slate-50 to-white py-20 px-4">
      <div className="max-w-3xl mx-auto text-center">
        {/* Headline */}
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
          Find the best real estate agents
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500">
            in Arizona
          </span>
        </h1>
        
        {/* Subheadline */}
        <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto">
          The top 10 in every Arizona city. Ranked by reviews, verified by data.
          No ads. No pay-to-play.
        </p>
        
        {/* Search Box */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex items-center gap-2 max-w-xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 p-2">
            <div className="flex-1 flex items-center gap-3 px-4">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter an Arizona city or zip code"
                className="flex-1 py-3 text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all"
            >
              Search
            </button>
          </div>
        </form>
        
        {/* Popular Cities */}
        <div className="flex items-center justify-center gap-2 flex-wrap text-sm">
          <span className="text-slate-400">Popular:</span>
          {popularCities.map((city, index) => (
            <span key={city.slug} className="flex items-center">
              <a 
                href={`/arizona/${city.slug}/top-realtors`}
                className="text-slate-600 hover:text-blue-500 transition-colors"
              >
                {city.name}
              </a>
              {index < popularCities.length - 1 && (
                <span className="text-slate-300 mx-2">·</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
