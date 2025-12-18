import { Phone } from "lucide-react";

export function ContactSupportBanner() {
  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
      <div className="flex items-center justify-center gap-2 text-primary font-medium">
        <Phone className="h-4 w-4" />
        <span>If you have any questions or concerns, call us at</span>
        <a 
          href="tel:+16027589600" 
          className="font-bold hover:underline"
        >
          (602) 758-9600
        </a>
      </div>
    </div>
  );
}
