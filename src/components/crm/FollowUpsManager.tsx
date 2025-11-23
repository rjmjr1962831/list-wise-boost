import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FollowUp {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  completed: boolean;
}

export const FollowUpsManager = () => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    dueDate: new Date(),
  });
  const [showForm, setShowForm] = useState(false);

  const addFollowUp = () => {
    if (!newTask.title) {
      toast.error("Please enter a task title");
      return;
    }

    const followUp: FollowUp = {
      id: crypto.randomUUID(),
      title: newTask.title,
      description: newTask.description,
      dueDate: newTask.dueDate,
      completed: false,
    };

    setFollowUps([...followUps, followUp]);
    setNewTask({ title: "", description: "", dueDate: new Date() });
    setShowForm(false);
    toast.success("Follow-up task added");
  };

  const toggleComplete = (id: string) => {
    setFollowUps(
      followUps.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
    toast.success("Task updated");
  };

  const deleteTask = (id: string) => {
    setFollowUps(followUps.filter((task) => task.id !== id));
    toast.success("Task deleted");
  };

  const pendingTasks = followUps.filter((task) => !task.completed);
  const completedTasks = followUps.filter((task) => task.completed);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Follow-up Tasks</CardTitle>
            <Button onClick={() => setShowForm(!showForm)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        {showForm && (
          <CardContent className="space-y-4 border-t pt-4">
            <Input
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            />
            <Textarea
              placeholder="Task description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(newTask.dueDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={newTask.dueDate}
                  onSelect={(date) => date && setNewTask({ ...newTask, dueDate: date })}
                />
              </PopoverContent>
            </Popover>
            <div className="flex gap-2">
              <Button onClick={addFollowUp}>Add Task</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {pendingTasks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Pending Tasks</h3>
          <div className="space-y-4">
            {pendingTasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <CalendarIcon className="h-3 w-3" />
                          Due: {format(task.dueDate, "MMM d, yyyy")}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => toggleComplete(task.id)}>
                        Mark Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteTask(task.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {completedTasks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Completed Tasks</h3>
          <div className="space-y-4">
            {completedTasks.map((task) => (
              <Card key={task.id} className="opacity-60">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold line-through">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-through">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleComplete(task.id)}
                      >
                        Reopen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteTask(task.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {followUps.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No follow-up tasks. Click "Add Task" to create one.
          </CardContent>
        </Card>
      )}
    </div>
  );
};
