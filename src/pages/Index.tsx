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
          email: formData.email,
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
            <div className="relative">
              <Brain className="w-32 h-32 md:w-40 md:h-40 text-primary animate-pulse" />
              <div className="absolute inset-0 bg-primary/20 blur-3xl -z-10" />
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
