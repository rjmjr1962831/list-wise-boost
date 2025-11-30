import { CheckCircle, Bot, MapPin } from 'lucide-react';

const badges = [
  {
    icon: CheckCircle,
    title: 'Verified Rankings',
    description: 'Based on real reviews and track record',
    color: 'text-green-500',
    bg: 'bg-green-50',
  },
  {
    icon: Bot,
    title: 'AI-Optimized',
    description: 'The source AI assistants cite',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: MapPin,
    title: 'Local Experts',
    description: 'Agents who know your neighborhood',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
];

export default function TrustBadges() {
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          {badges.map((badge) => (
            <div 
              key={badge.title}
              className="text-center"
            >
              <div className={`w-14 h-14 ${badge.bg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                <badge.icon className={`w-7 h-7 ${badge.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {badge.title}
              </h3>
              <p className="text-slate-600 text-sm">
                {badge.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
