import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Professional } from "@/types/professional";
import { ProfessionalCard } from "./ProfessionalCard";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AgentDetailModalProps {
  professional: Professional | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market?: string;
  stateAbbr?: string;
  agentType?: string;
  citySlug?: string;
  categorySlug?: string;
}

export function AgentDetailModal({
  professional,
  open,
  onOpenChange,
  market,
  stateAbbr,
  agentType,
  citySlug,
  categorySlug,
}: AgentDetailModalProps) {
  if (!professional) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-2xl">
            {professional.name}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
          <ProfessionalCard
            professional={professional}
            market={market}
            stateAbbr={stateAbbr}
            agentType={agentType}
            citySlug={citySlug}
            categorySlug={categorySlug}
            quizCompleted={true}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
