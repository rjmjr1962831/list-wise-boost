import { SafeHead } from "@/components/SafeHead";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Home, Phone } from "lucide-react";

export default function PaymentSuccess() {
  return (
    <>
      <SafeHead>
        <title>Thank You for Your Purchase | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-6">
                <div className="rounded-full bg-green-100 dark:bg-green-900 p-6">
                  <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold">Thank you for your purchase.</h1>
              <p className="text-lg text-muted-foreground">
                Watch for an email from our founder, Robert at Top10Lists, with instructions on how to build your Web of Truth™.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button asChild variant="outline" className="gap-2">
                  <a href="/">
                    <Home className="h-4 w-4" />
                    Go to Homepage
                  </a>
                </Button>
                <Button asChild className="gap-2">
                  <a href="tel:6027589600">
                    <Phone className="h-4 w-4" />
                    Call Us: (602) 758-9600
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
