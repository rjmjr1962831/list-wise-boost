import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Calendar, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Contact {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string;
  created_at: string;
}

export const ContactsManager = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load contacts");
      console.error(error);
    } else {
      setContacts(data || []);
    }
    setIsLoading(false);
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const extractCityFromMessage = (message: string): string | null => {
    const cityMatch = message.match(/City:\s*([^|]+)/);
    if (cityMatch) {
      const city = cityMatch[1].trim();
      // Convert "Scottsdale, Arizona" to "scottsdale-az"
      const [cityName, state] = city.split(',').map(s => s.trim());
      const stateAbbr = state === 'Arizona' ? 'az' : state.toLowerCase().slice(0, 2);
      return `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateAbbr}`;
    }
    return null;
  };

  const handleViewProfile = (contact: Contact) => {
    const citySlug = extractCityFromMessage(contact.message);
    if (citySlug) {
      navigate(`/${citySlug}/realtors`);
    } else {
      toast.error("Could not determine city for this contact");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredContacts.map((contact) => (
          <Card key={contact.id}>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{contact.full_name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(contact.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  <Badge variant="outline">New</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                      {contact.email}
                    </a>
                  </div>
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                        {contact.phone}
                      </a>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm whitespace-pre-line">{contact.message}</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="default" onClick={() => handleViewProfile(contact)}>
                    <ExternalLink className="mr-1 h-3 w-3" />
                    View Profile
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`mailto:${contact.email}`}>Reply</a>
                  </Button>
                  {contact.phone && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`tel:${contact.phone}`}>Call</a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredContacts.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No contacts found
          </CardContent>
        </Card>
      )}
    </div>
  );
};
