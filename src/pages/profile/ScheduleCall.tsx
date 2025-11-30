import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar, Phone, Mail, CheckCircle2 } from 'lucide-react';

export default function ScheduleCall() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Pipedrive Scheduler URL - Replace with actual URL from Pipedrive
  const SCHEDULER_URL = 'https://pipedrive.com/scheduler/YOUR_SCHEDULER_ID';

  useEffect(() => {
    if (token) {
      // Track schedule view
      supabase.functions.invoke('track-profile-event', {
        body: { token, event_name: 'schedule_viewed' }
      });
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Let's Get You Started
          </h1>
          <p className="text-xl text-muted-foreground">
            Schedule a quick 15-minute call to finalize your setup
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Scheduler Iframe */}
          <Card className="lg:col-span-2 p-6">
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-4">
              {/* Replace this with actual Pipedrive scheduler embed */}
              <iframe
                src={SCHEDULER_URL}
                width="100%"
                height="600"
                frameBorder="0"
                title="Schedule Appointment"
                className="rounded-lg"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Choose a time that works best for you
            </p>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* What We'll Cover */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                What We'll Cover
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    Finalize your city selections
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    Review your profile details
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    Answer any questions
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    Set your go-live date
                  </span>
                </li>
              </ul>
            </Card>

            {/* Alternative Contact */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Prefer Another Way?
              </h3>
              <div className="space-y-3">
                <a
                  href="tel:+14805551234"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <Phone className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm font-medium text-foreground">Call Us</div>
                    <div className="text-sm text-muted-foreground">(480) 555-1234</div>
                  </div>
                </a>
                <a
                  href="mailto:hello@top10lists.us"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm font-medium text-foreground">Email Us</div>
                    <div className="text-sm text-muted-foreground">hello@top10lists.us</div>
                  </div>
                </a>
              </div>
            </Card>

            {/* Back Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(`/profile/${token}/pricing`)}
            >
              ← Back to Pricing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}