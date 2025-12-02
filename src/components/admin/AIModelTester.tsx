import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Bot, Loader2, Zap, Brain, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

const TASK_TYPES = [
  { value: 'general', label: 'General (Gemini Flash)', icon: Zap, color: 'text-blue-500' },
  { value: 'bio-generation', label: 'Bio Generation (DeepSeek)', icon: DollarSign, color: 'text-green-500' },
  { value: 'email-draft', label: 'Email Draft (DeepSeek)', icon: DollarSign, color: 'text-green-500' },
  { value: 'specialty-extraction', label: 'Specialty Extraction (DeepSeek)', icon: DollarSign, color: 'text-green-500' },
  { value: 'press-extraction', label: 'Press Extraction (Claude)', icon: Brain, color: 'text-purple-500' },
  { value: 'profile-synthesis', label: 'Profile Synthesis (Claude)', icon: Brain, color: 'text-purple-500' },
  { value: 'document-analysis', label: 'Document Analysis (Claude)', icon: Brain, color: 'text-purple-500' },
  { value: 'complex-reasoning', label: 'Complex Reasoning (Claude)', icon: Brain, color: 'text-purple-500' },
  { value: 'quick-response', label: 'Quick Response (GPT-5 Nano)', icon: Zap, color: 'text-yellow-500' },
  { value: 'critical-analysis', label: 'Critical Analysis (GPT-5)', icon: Brain, color: 'text-red-500' },
];

const MODEL_OVERRIDES = [
  { value: '', label: 'Auto (use task routing)' },
  { value: 'gemini-flash', label: 'Gemini Flash' },
  { value: 'gemini-pro', label: 'Gemini Pro' },
  { value: 'gpt5', label: 'GPT-5' },
  { value: 'gpt5-mini', label: 'GPT-5 Mini' },
  { value: 'gpt5-nano', label: 'GPT-5 Nano' },
  { value: 'claude-sonnet', label: 'Claude Sonnet 4.5' },
  { value: 'claude-opus', label: 'Claude Opus 4.1' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
];

interface AIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  routing?: {
    task: string;
    selectedModel: string;
    provider: string;
    model: string;
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const AIModelTester: React.FC = () => {
  const [task, setTask] = useState('general');
  const [modelOverride, setModelOverride] = useState('');
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const handleTest = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setResponse(null);
    setResponseTime(null);
    const startTime = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('ai-router', {
        body: {
          task,
          messages: [{ role: 'user', content: prompt }],
          systemPrompt,
          model: modelOverride || undefined,
        },
      });

      if (error) throw error;

      setResponse(data);
      setResponseTime(Date.now() - startTime);
      toast.success(`Response from ${data.routing?.provider || 'AI'}`);
    } catch (error) {
      console.error('AI test error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTaskInfo = TASK_TYPES.find(t => t.value === task);
  const TaskIcon = selectedTaskInfo?.icon || Bot;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Model Router Tester
        </CardTitle>
        <CardDescription>
          Test the multi-model routing system. Tasks are automatically routed to the best model.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model routing legend */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/50 text-xs">
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-green-500" />
            <span>DeepSeek = Cost-effective</span>
          </div>
          <div className="flex items-center gap-1">
            <Brain className="h-3 w-3 text-purple-500" />
            <span>Claude = Complex reasoning</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-blue-500" />
            <span>Gemini/GPT = Fast/General</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="task">Task Type (Auto-routes to best model)</Label>
            <Select value={task} onValueChange={setTask}>
              <SelectTrigger id="task">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <t.icon className={`h-4 w-4 ${t.color}`} />
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model-override">Model Override (optional)</Label>
            <Select value={modelOverride} onValueChange={setModelOverride}>
              <SelectTrigger id="model-override">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OVERRIDES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="system-prompt">System Prompt</Label>
          <Input
            id="system-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful assistant..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">User Prompt</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            rows={3}
          />
        </div>

        <Button onClick={handleTest} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <TaskIcon className={`mr-2 h-4 w-4 ${selectedTaskInfo?.color}`} />
              Test AI Router
            </>
          )}
        </Button>

        {response && (
          <div className="space-y-3 mt-4">
            {/* Routing info */}
            {response.routing && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <span className="text-muted-foreground">Provider:</span>
                    <p className="font-medium capitalize">{response.routing.provider}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Model:</span>
                    <p className="font-medium">{response.routing.selectedModel}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Response Time:</span>
                    <p className="font-medium">{responseTime ? `${(responseTime / 1000).toFixed(2)}s` : 'N/A'}</p>
                  </div>
                  {response.usage && (
                    <div>
                      <span className="text-muted-foreground">Tokens:</span>
                      <p className="font-medium">{response.usage.total_tokens}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Response content */}
            <div className="space-y-2">
              <Label>Response</Label>
              <ScrollArea className="h-64 rounded-lg border p-3">
                <pre className="whitespace-pre-wrap text-sm">
                  {response.choices?.[0]?.message?.content || 'No content'}
                </pre>
              </ScrollArea>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Routing Logic:</strong></p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li><strong>DeepSeek</strong>: Bio generation, email drafts, data extraction (cheapest)</li>
            <li><strong>Claude</strong>: Press extraction, profile synthesis, complex reasoning (most capable)</li>
            <li><strong>Gemini Flash</strong>: General tasks, chat, quick lookups (fast default)</li>
            <li><strong>GPT-5</strong>: Critical analysis, high-stakes tasks (most accurate)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIModelTester;
