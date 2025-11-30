import { Link } from 'react-router-dom';
import { ArrowRight, Star, Users } from 'lucide-react';

// This would come from your database in production
const featuredCities = [
  {
    slug: 'phoenix-az',
    city: 'Phoenix',
    state: 'AZ',
    agentCount: 10,
    avgRating: 4.9,
    avgReviews: 127,
  },
  {
    slug: 'scottsdale-az',
    city: 'Scottsdale',
    state: 'AZ',
    agentCount: 10,
    avgRating: 4.8,
    avgReviews: 94,
  },
  {
    slug: 'mesa-az',
    city: 'Mesa',
    state: 'AZ',
    agentCount: 10,
    avgRating: 4.9,
    avgReviews: 82,
  },
  {
    slug: 'chandler-az',
    city: 'Chandler',
    state: 'AZ',
    agentCount: 10,
    avgRating: 4.8,
    avgReviews: 76,
  },
];

export default function FeaturedLists() {
  return (
    <section className="py-16 px-4 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Arizona Top 10 Lists
          </h2>
          <p className="text-slate-600">
            Find the highest-rated agents in the Valley and beyond
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredCities.map((city) => (
            <Link
              key={city.slug}
              to={`/arizona/${city.slug}/top-realtors`}
              className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all"
            >
              {/* City Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {city.city}
                  </h3>
                  <p className="text-slate-500 text-sm">{city.state}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white font-bold">
                  10
                </div>
              </div>
              
              {/* Stats */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>{city.avgRating} avg rating</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{city.avgReviews} avg reviews</span>
                </div>
              </div>
              
              {/* CTA */}
              <div className="flex items-center text-blue-500 font-medium text-sm group-hover:gap-2 transition-all">
                <span>View Top 10</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
        
        {/* View All Link */}
        <div className="text-center mt-10">
          <Link 
            to="/arizona"
            className="text-slate-600 hover:text-blue-500 text-sm font-medium inline-flex items-center gap-1"
          >
            View all Arizona cities
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
