import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StateAgentSearchResult } from '@/hooks/useStateAgentSearch';

interface AgentSearchResultsTableProps {
  results: StateAgentSearchResult[];
  isLoading: boolean;
  onViewDetails: (agent: StateAgentSearchResult) => void;
  onApprove: (agent: StateAgentSearchResult) => void;
  onApply: (agent: StateAgentSearchResult) => void;
}

export function AgentSearchResultsTable({
  results,
  isLoading,
  onViewDetails,
  onApprove,
  onApply,
}: AgentSearchResultsTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>First Name</TableHead>
              <TableHead>Last Name</TableHead>
              <TableHead>Neighborhood Expert</TableHead>
              <TableHead>Listed</TableHead>
              <TableHead className="w-[140px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                <TableCell><Skeleton className="h-8 w-20" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">No agents found matching your search.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>First Name</TableHead>
            <TableHead>Last Name</TableHead>
            <TableHead>Neighborhood Expert</TableHead>
            <TableHead>Listed</TableHead>
            <TableHead className="w-[140px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((agent) => {
            // Determine row background based on status
            let rowClassName = '';
            if (agent.isNeighborhoodExpert) {
              rowClassName = 'bg-accent/30';
            } else if (agent.isListed) {
              rowClassName = 'bg-accent/10';
            }

            return (
              <TableRow key={agent.id} className={rowClassName}>
                <TableCell className="font-medium">{agent.firstName}</TableCell>
                <TableCell>{agent.lastName}</TableCell>
                <TableCell>
                  {agent.isNeighborhoodExpert ? (
                    <span>Yes</span>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell>
                  {agent.isListed ? (
                    <span>Yes</span>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell className="space-x-2">
                  {agent.isListed ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onApprove(agent)}
                    >
                      Approve
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onApply(agent)}
                    >
                      Apply
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(agent)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
