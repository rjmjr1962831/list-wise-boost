import HeroSearch from "@/components/home/HeroSearch";
import TrustBadges from "@/components/home/TrustBadges";
import FeaturedLists from "@/components/home/FeaturedLists";
import Testimonial from "@/components/home/Testimonial";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <HeroSearch />
        <TrustBadges />
        <FeaturedLists />
        <Testimonial />
      </main>
    </div>
  );
};

export default Index;