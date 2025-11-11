import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MarketingContent } from "@/hooks/useMarketingContent";

export const MarketingContentManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: content, isLoading } = useQuery({
    queryKey: ['marketing-content-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_content')
        .select('*')
        .eq('page', 'main')
        .order('section')
        .order('key');

      if (error) throw error;
      return data as MarketingContent[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase
        .from('marketing_content')
        .update({ value })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-content'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-content-admin'] });
      toast({
        title: "Content updated",
        description: "Marketing content has been updated successfully.",
      });
      setEditingId(null);
      setEditValue("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (item: MarketingContent) => {
    setEditingId(item.id);
    setEditValue(item.value);
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({ id, value: editValue });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue("");
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading marketing content...</div>;
  }

  const groupedContent = content?.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, MarketingContent[]>);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Marketing Content Manager</h2>
        <p className="text-muted-foreground">
          Edit the content that appears on your marketing pages. Changes will be reflected immediately.
        </p>
      </div>

      <Tabs defaultValue="hero" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          {Object.keys(groupedContent || {}).map((section) => (
            <TabsTrigger key={section} value={section} className="capitalize">
              {section.replace('_', ' ')}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(groupedContent || {}).map(([section, items]) => (
          <TabsContent key={section} value={section} className="space-y-4">
            {items.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base capitalize">
                        {item.key.replace(/_/g, ' ')}
                      </CardTitle>
                      <CardDescription>
                        {item.section}.{item.key}
                      </CardDescription>
                    </div>
                    <Badge variant={item.type === 'html' ? 'default' : 'secondary'}>
                      {item.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingId === item.id ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-${item.id}`}>Content</Label>
                        {item.type === 'text' ? (
                          <Input
                            id={`edit-${item.id}`}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                          />
                        ) : (
                          <Textarea
                            id={`edit-${item.id}`}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={6}
                            className="font-mono text-sm"
                          />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleSave(item.id)}
                          disabled={updateMutation.isPending}
                        >
                          Save Changes
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleCancel}
                          disabled={updateMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Current Content</Label>
                        {item.type === 'html' ? (
                          <div 
                            className="p-3 bg-muted rounded-md text-sm"
                            dangerouslySetInnerHTML={{ __html: item.value }}
                          />
                        ) : (
                          <p className="p-3 bg-muted rounded-md text-sm">{item.value}</p>
                        )}
                      </div>
                      <Button onClick={() => handleEdit(item)}>Edit</Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
