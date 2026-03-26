import { useLocation, useNavigate } from 'react-router-dom';
import { SafeHead } from '@/components/SafeHead';
import { RevenueGapBanner } from '@/components/funnel/RevenueGapBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Mail } from 'lucide-react';

interface InvoiceState {
  name: string;
  email: string;
  tier: string;
  amount: number;
  billingCycle: string;
}

export default function SandboxInvoiceSent() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as InvoiceState | null;

  const name = state?.name || 'Agent';
  const email = state?.email || '';
  const tier = state?.tier || 'audited';
  const amount = state?.amount || 0;
  const billingCycle = state?.billingCycle || 'monthly';

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const periodLabel = billingCycle === 'annual' ? '/yr' : '/mo';

  return (
    <>
      <SafeHead>
        <title>Invoice Sent | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-lg mx-auto space-y-6 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />

          <RevenueGapBanner professional={null} />

          <h1 className="text-2xl font-bold">Invoice Sent</h1>

          <Card>
            <CardContent className="py-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm text-left">
                <div>
                  <p className="text-muted-foreground text-xs">Agent</p>
                  <p className="font-medium">{name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Tier</p>
                  <p className="font-medium">{tierLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Amount</p>
                  <p className="font-medium">${amount.toLocaleString()}{periodLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Billing</p>
                  <p className="font-medium">{billingCycle === 'annual' ? 'Annual' : 'Monthly'}</p>
                </div>
              </div>

              <div className="border-t pt-4 flex items-start gap-3 text-left">
                <Mail className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  A secure Stripe payment link has been sent to{' '}
                  <span className="font-medium text-foreground">{email}</span>.
                  The agent can pay at their convenience using the link in the email.
                </p>
              </div>
            </CardContent>
          </Card>

          <Button onClick={() => navigate('/crm')} className="gap-2">
            Back to Tasks
          </Button>
        </div>
      </div>
    </>
  );
}
