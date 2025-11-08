import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain } from "lucide-react";

const Index = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("contacts").insert([
        {
          full_name: formData.fullName,
          email: "robert@top10lists.us",
          phone: formData.phone || null,
          message: formData.message,
        },
      ]);

      if (error) throw error;

      toast.success("Thank you! We'll get back to you soon.");
      setFormData({ fullName: "", email: "", phone: "", message: "" });
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <div className="max-w-4xl w-full space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative w-full max-w-md aspect-square">
              {/* SVG for neuron-like connections with animated light packets */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <filter id="strongGlow">
                    <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <radialGradient id="packetGradient">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                    <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </radialGradient>
                </defs>
                
                {/* Top-left to Top-right - curved path */}
                <path id="path1" d="M 80 80 Q 200 40 320 80" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" opacity="0.4" filter="url(#glow)" />
                <circle r="8" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.5s" repeatCount="indefinite"><mpath href="#path1" /></animateMotion>
                </circle>
                <circle r="6" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.5s" repeatCount="indefinite" begin="0.5s"><mpath href="#path1" /></animateMotion>
                </circle>
                <circle r="7" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.5s" repeatCount="indefinite" begin="1s" keyPoints="1;0" keyTimes="0;1"><mpath href="#path1" /></animateMotion>
                </circle>
                
                {/* Top-right to Bottom-right - curved path */}
                <path id="path2" d="M 320 80 Q 360 200 320 320" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" opacity="0.4" filter="url(#glow)" />
                <circle r="7" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.8s" repeatCount="indefinite" begin="0.2s"><mpath href="#path2" /></animateMotion>
                </circle>
                <circle r="8" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.8s" repeatCount="indefinite" begin="0.8s"><mpath href="#path2" /></animateMotion>
                </circle>
                <circle r="6" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.8s" repeatCount="indefinite" begin="0.4s" keyPoints="1;0" keyTimes="0;1"><mpath href="#path2" /></animateMotion>
                </circle>
                
                {/* Bottom-right to Bottom-left - curved path */}
                <path id="path3" d="M 320 320 Q 200 360 80 320" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" opacity="0.4" filter="url(#glow)" />
                <circle r="9" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.6s" repeatCount="indefinite" begin="0.3s"><mpath href="#path3" /></animateMotion>
                </circle>
                <circle r="7" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.6s" repeatCount="indefinite" begin="0.9s"><mpath href="#path3" /></animateMotion>
                </circle>
                <circle r="6" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.6s" repeatCount="indefinite" begin="0.1s" keyPoints="1;0" keyTimes="0;1"><mpath href="#path3" /></animateMotion>
                </circle>
                
                {/* Bottom-left to Top-left - curved path */}
                <path id="path4" d="M 80 320 Q 40 200 80 80" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" opacity="0.4" filter="url(#glow)" />
                <circle r="8" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="0.6s"><mpath href="#path4" /></animateMotion>
                </circle>
                <circle r="7" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="0s"><mpath href="#path4" /></animateMotion>
                </circle>
                <circle r="6" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="0.7s" keyPoints="1;0" keyTimes="0;1"><mpath href="#path4" /></animateMotion>
                </circle>
                
                {/* Top-left to Bottom-right - organic diagonal */}
                <path id="path5" d="M 80 80 Q 180 180 320 320" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" opacity="0.4" filter="url(#glow)" />
                <circle r="9" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="2.2s" repeatCount="indefinite" begin="0.4s"><mpath href="#path5" /></animateMotion>
                </circle>
                <circle r="7" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="2.2s" repeatCount="indefinite" begin="1.1s"><mpath href="#path5" /></animateMotion>
                </circle>
                <circle r="8" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="2.2s" repeatCount="indefinite" begin="0.2s" keyPoints="1;0" keyTimes="0;1"><mpath href="#path5" /></animateMotion>
                </circle>
                <circle r="6" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="2.2s" repeatCount="indefinite" begin="1.5s" keyPoints="1;0" keyTimes="0;1"><mpath href="#path5" /></animateMotion>
                </circle>
                
                {/* Top-right to Bottom-left - organic diagonal */}
                <path id="path6" d="M 320 80 Q 220 180 80 320" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" opacity="0.4" filter="url(#glow)" />
                <circle r="7" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.9s" repeatCount="indefinite" begin="0.5s"><mpath href="#path6" /></animateMotion>
                </circle>
                <circle r="8" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.9s" repeatCount="indefinite" begin="1.2s"><mpath href="#path6" /></animateMotion>
                </circle>
                <circle r="9" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.9s" repeatCount="indefinite" begin="0.3s" keyPoints="1;0" keyTimes="0;1"><mpath href="#path6" /></animateMotion>
                </circle>
                <circle r="6" fill="url(#packetGradient)" filter="url(#strongGlow)">
                  <animateMotion dur="1.9s" repeatCount="indefinite" begin="0.8s" keyPoints="1;0" keyTimes="0;1"><mpath href="#path6" /></animateMotion>
                </circle>
              </svg>
              
              {/* Four brains positioned at corners */}
              <div className="absolute top-0 left-0 w-24 h-24">
                <Brain className="w-full h-full text-primary animate-pulse" />
                <div className="absolute inset-0 bg-primary/30 blur-2xl -z-10 animate-pulse" />
              </div>
              <div className="absolute top-0 right-0 w-24 h-24">
                <Brain className="w-full h-full text-primary animate-pulse" style={{ animationDelay: '0.5s' }} />
                <div className="absolute inset-0 bg-primary/30 blur-2xl -z-10 animate-pulse" style={{ animationDelay: '0.5s' }} />
              </div>
              <div className="absolute bottom-0 left-0 w-24 h-24">
                <Brain className="w-full h-full text-primary animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute inset-0 bg-primary/30 blur-2xl -z-10 animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
              <div className="absolute bottom-0 right-0 w-24 h-24">
                <Brain className="w-full h-full text-primary animate-pulse" style={{ animationDelay: '1.5s' }} />
                <div className="absolute inset-0 bg-primary/30 blur-2xl -z-10 animate-pulse" style={{ animationDelay: '1.5s' }} />
              </div>
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground">
            We're thinking.
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            Leave us a note and we'll get back to you
          </p>
        </div>

        {/* Contact Form */}
        <div className="bg-card p-8 rounded-lg shadow-lg border border-border max-w-xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">
                How can we help? <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="message"
                placeholder="Tell us what you're thinking about..."
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                required
                className="min-h-[120px]"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Index;
