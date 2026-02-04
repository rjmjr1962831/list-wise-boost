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
import { Link } from 'react-router-dom';

interface AgentSearchResultsTableProps {
  results: StateAgentSearchResult[];
  isLoading: boolean;
}

export function AgentSearchResultsTable({
  results,
  isLoading,
}: AgentSearchResultsTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>First Name</TableHead>
              <TableHead>Last Name</TableHead>
              <TableHead className="w-[100px]">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
            <TableHead className="w-[100px]">View</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((agent) => {
            // Build agent profile URL
            const profileUrl = agent.canonicalSlug && agent.stateSlug
              ? `/${agent.stateSlug}/agents/${agent.canonicalSlug}`
              : agent.legacyUrlSlug
              ? `/${agent.stateSlug}/agents/${agent.legacyUrlSlug}`
              : null;

            return (
              <TableRow key={agent.id}>
                <TableCell className="font-medium">{agent.firstName}</TableCell>
                <TableCell>{agent.lastName}</TableCell>
                <TableCell>
                  {profileUrl ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <Link to={profileUrl}>View</Link>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                    >
                      View
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
