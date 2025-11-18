import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

const PaymentComingSoon = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full text-center">
        <Rocket className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-4">Payment System Coming Soon!</h1>
        <p className="text-muted-foreground mb-6">
          We're building an amazing payment experience for you. Your application has been saved, 
          and we'll notify you as soon as the payment system is ready.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          In the meantime, our team will review your application and reach out to you directly.
        </p>
        <Button onClick={() => navigate("/")} className="w-full">
          Return to Homepage
        </Button>
      </Card>
    </div>
  );
};

export default PaymentComingSoon;
