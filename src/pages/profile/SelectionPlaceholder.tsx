import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function SelectionPlaceholder() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="p-12 text-center">
          <Construction className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-foreground mb-4">
            City Selection Coming Soon
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            We're building an interactive city selector to help you choose your markets. 
            For now, let's schedule a quick call to get you set up!
          </p>
          
          <div className="space-y-4">
            <Button 
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => navigate(`/profile/${token}/schedule`)}
            >
              Schedule a Call
            </Button>
            
            <div className="text-sm text-muted-foreground">
              or email us at{' '}
              <a href="mailto:hello@top10lists.us" className="text-primary hover:underline">
                hello@top10lists.us
              </a>
            </div>
          </div>

          <Button
            variant="ghost"
            className="mt-8"
            onClick={() => navigate(`/profile/${token}/pricing`)}
          >
            ← Back to Pricing
          </Button>
        </Card>
      </div>
    </div>
  );
}