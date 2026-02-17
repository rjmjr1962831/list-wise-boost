import { useState, useEffect } from 'react';
import { SafeHead } from "@/components/SafeHead";
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useStateAgentSearch } from '@/hooks/useStateAgentSearch';
import { AgentSearchResultsTable } from '@/components/agent-search/AgentSearchResultsTable';

// Currently supported states
const STATES = [
  { value: 'arizona', label: 'Arizona' },
  // More states can be added here as coverage expands
];

export default function AgentLookup() {
  const [searchParams] = useSearchParams();
  
  // Initialize from URL params
  const initialQuery = searchParams.get('q') || '';
  const initialState = searchParams.get('state') || 'arizona';
  
  const [selectedState, setSelectedState] = useState(initialState);
  
  const {
    query,
    setQuery,
    results,
    isSearching,
    error,
    search,
    clearResults,
  } = useStateAgentSearch();

  // Initialize query from URL on mount
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery, setQuery]);

  // Trigger search when query or state changes
  useEffect(() => {
    if (query) {
      search(query, selectedState);
    }
  }, [query, selectedState, search]);

  const handleClearSearch = () => {
    clearResults();
  };

  return (
    <>
      <SafeHead>
        <title>Check an Agent - Top10Lists</title>
        <meta
          name="description"
          content="Search for any licensed real estate agent by name and view their listing status on Top10Lists."
        />
        <link rel="canonical" href="https://www.top10lists.us/check-agent" />
      </SafeHead>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Check an Agent</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-3">Check an Agent</h1>
          <p className="text-muted-foreground">
            Search for any licensed real estate agent by name. This tool shows listing status and public qualification data.
          </p>
        </div>

        {/* Search Controls */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* State Selector */}
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by agent name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={handleClearSearch}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear search</span>
                </Button>
              )}
            </div>
          </div>

          {/* Instructions */}
          <p className="text-sm text-muted-foreground">
            Enter at least 2 characters to search. Results include all licensed agents, regardless of listing status.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Results Table */}
        {(query.length >= 2 || results.length > 0 || isSearching) && (
          <AgentSearchResultsTable
            results={results}
            isLoading={isSearching}
          />
        )}
      </div>
    </>
  );
}
