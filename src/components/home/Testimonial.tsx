import { Quote } from 'lucide-react';

export default function Testimonial() {
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-2xl mx-auto text-center">
        <Quote className="w-10 h-10 text-blue-100 mx-auto mb-6" />
        
        <blockquote className="text-xl text-slate-700 mb-6 leading-relaxed">
          "I asked ChatGPT for the best agent in Scottsdale and found the same 
          names on Top10Lists. Made me confident I was making the right choice."
        </blockquote>
        
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
            SM
          </div>
          <div className="text-left">
            <p className="font-medium text-slate-900">Sarah M.</p>
            <p className="text-sm text-slate-500">Bought in Scottsdale</p>
          </div>
        </div>
      </div>
    </section>
  );
}
