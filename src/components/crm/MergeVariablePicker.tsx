/**
 * MergeVariablePicker — popup dialog with radio buttons for selecting
 * merge variables. Used on all email compose/template surfaces.
 */
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MERGE_VARIABLES, getCategories, toMergeTag } from "./merge-variables";
import { Search, Variable } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (tag: string, key: string, label: string) => void;
}

export function MergeVariablePicker({ open, onClose, onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const categories = useMemo(() => getCategories(), []);

  const filtered = useMemo(() => {
    if (!search.trim()) return MERGE_VARIABLES;
    const q = search.toLowerCase();
    return MERGE_VARIABLES.filter(
      (v) =>
        v.label.toLowerCase().includes(q) ||
        v.key.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q),
    );
  }, [search]);

  const filteredCategories = useMemo(() => {
    const cats = new Set(filtered.map((v) => v.category));
    return categories.filter((c) => cats.has(c));
  }, [filtered, categories]);

  const handleInsert = () => {
    if (!selected) return;
    const v = MERGE_VARIABLES.find((m) => m.key === selected);
    if (v) {
      onSelect(toMergeTag(v.key), v.key, v.label);
    }
    setSelected(null);
    setSearch("");
    onClose();
  };

  const handleClose = () => {
    setSelected(null);
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Variable className="h-5 w-5" />
            Insert Merge Variable
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search variables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
          {filteredCategories.map((cat) => (
            <div key={cat}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {cat}
              </h4>
              <div className="space-y-1">
                {filtered
                  .filter((v) => v.category === cat)
                  .map((v) => (
                    <label
                      key={v.key}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                        selected === v.key
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted border border-transparent"
                      }`}
                    >
                      <input
                        type="radio"
                        name="merge-var"
                        value={v.key}
                        checked={selected === v.key}
                        onChange={() => setSelected(v.key)}
                        className="accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{v.label}</span>
                        {v.linkText ? (
                          <span className="text-xs text-blue-600 ml-2">
                            inserts as "{v.linkText}" link
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground ml-2">
                            {toMergeTag(v.key)}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No variables match "{search}"
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={!selected}>
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
