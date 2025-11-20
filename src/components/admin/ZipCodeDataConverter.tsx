import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Download, RefreshCw } from 'lucide-react';

export function ZipCodeDataConverter() {
  const [isConverting, setIsConverting] = useState(false);
  const [convertedData, setConvertedData] = useState<any>(null);

  const handleConvert = async () => {
    setIsConverting(true);
    try {
      const { data, error } = await supabase.functions.invoke('convert-zipcode-data');
      
      if (error) throw error;
      
      setConvertedData(data.data);
      toast.success(`Converted ${data.totalCities} cities successfully!`);
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert zip code data');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!convertedData) return;
    
    const jsonString = JSON.stringify(convertedData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zipCodeData.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('File downloaded! Replace src/data/zipCodeData.json and supabase/functions/zipCodeData.json with this file.');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zip Code Data Converter</CardTitle>
        <CardDescription>
          Convert the JSONL zip code data to the nested JSON structure
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={handleConvert} 
            disabled={isConverting}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isConverting ? 'animate-spin' : ''}`} />
            Convert Data
          </Button>
          
          {convertedData && (
            <Button 
              onClick={handleDownload}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download JSON
            </Button>
          )}
        </div>

        {convertedData && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Converted <strong>{convertedData.length}</strong> cities with suburb information
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Download the file and manually replace:
              <br />
              • src/data/zipCodeData.json
              <br />
              • supabase/functions/zipCodeData.json
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
