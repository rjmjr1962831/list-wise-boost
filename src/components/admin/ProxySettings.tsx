import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Save, TestTube } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface ProxyCredentials {
  endpoint: string;
  username: string;
  password: string;
  protocol: 'HTTP' | 'Socks5' | 'HTTP/Socks5';
}

export const ProxySettings = () => {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const [credentials, setCredentials] = useState<ProxyCredentials>({
    endpoint: 'rp.scrapegw.com:6060',
    username: '',
    password: '',
    protocol: 'HTTP/Socks5'
  });

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-proxy-connection', {
        body: credentials
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Proxy connection successful',
          description: data.message || 'Proxy settings are valid and working.',
        });
        console.log('Proxy test result:', data);
      } else {
        toast({
          title: 'Proxy connection test',
          description: data.note || data.error || 'Unable to verify proxy connection directly.',
        });
        console.log('Proxy test result:', data);
      }
    } catch (error) {
      console.error('Error testing proxy:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      toast({
        title: 'Test failed',
        description: errorMessage || 'Could not test proxy connection. Check credentials.',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-proxy-settings', {
        body: credentials
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Proxy settings validated',
          description: 'Your proxy credentials have been validated successfully.',
        });
        console.log('Proxy settings saved:', data);
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving proxy settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to save proxy settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credentials Overview</CardTitle>
        <CardDescription>
          Configure your rotating proxy settings for web scraping operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="proxy-endpoint">Proxy endpoint</Label>
          <Input
            id="proxy-endpoint"
            value={credentials.endpoint}
            onChange={(e) => setCredentials({ ...credentials, endpoint: e.target.value })}
            placeholder="rp.scrapegw.com:6060"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="proxy-username">Proxy username</Label>
          <Input
            id="proxy-username"
            value={credentials.username}
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
            placeholder="wslet3ycrlwml6w"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="proxy-password">Proxy password</Label>
          <div className="relative">
            <Input
              id="proxy-password"
              type={showPassword ? 'text' : 'password'}
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              placeholder="Enter proxy password"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="proxy-protocol">Protocol</Label>
          <Select
            value={credentials.protocol}
            onValueChange={(value: 'HTTP' | 'Socks5' | 'HTTP/Socks5') => 
              setCredentials({ ...credentials, protocol: value })
            }
          >
            <SelectTrigger id="proxy-protocol">
              <SelectValue placeholder="Select protocol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HTTP">HTTP</SelectItem>
              <SelectItem value="Socks5">Socks5</SelectItem>
              <SelectItem value="HTTP/Socks5">HTTP/Socks5</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-between items-center pt-4">
          <Button
            variant="link"
            className="text-sm text-muted-foreground px-0"
            onClick={() => setCredentials({ ...credentials, password: '' })}
          >
            Reset password
          </Button>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleTest} 
              disabled={isTesting || !credentials.username || !credentials.password}
              variant="outline"
            >
              <TestTube className="mr-2 h-4 w-4" />
              {isTesting ? 'Testing...' : 'Test connection'}
            </Button>
            
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !credentials.username || !credentials.password}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save settings'}
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground pt-4 border-t">
          <p className="font-medium mb-2">Current configuration:</p>
          <div className="space-y-1 font-mono text-xs bg-muted/50 p-3 rounded">
            <p>Endpoint: {credentials.endpoint || 'Not set'}</p>
            <p>Username: {credentials.username || 'Not set'}</p>
            <p>Password: {credentials.password ? '••••••••••••' : 'Not set'}</p>
            <p>Protocol: {credentials.protocol}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
