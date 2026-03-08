import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowRight, Minus, Plus, Equal } from "lucide-react";

interface ScriptVersion {
  id: string;
  version_number: number;
  script: string;
  change_reason: string | null;
  rejection_comment: string | null;
  created_at: string;
}

interface ScriptDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: ScriptVersion[];
  initialLeftId?: string;
  initialRightId?: string;
}

function diffLines(oldText: string, newText: string) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: { type: "same" | "removed" | "added"; text: string }[] = [];

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      lcs.unshift(oldLines[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  // Build diff output
  let oi = 0, ni = 0, li = 0;
  while (oi < m || ni < n) {
    if (li < lcs.length && oi < m && oldLines[oi] === lcs[li] && ni < n && newLines[ni] === lcs[li]) {
      result.push({ type: "same", text: lcs[li] });
      oi++; ni++; li++;
    } else if (oi < m && (li >= lcs.length || oldLines[oi] !== lcs[li])) {
      result.push({ type: "removed", text: oldLines[oi] });
      oi++;
    } else if (ni < n && (li >= lcs.length || newLines[ni] !== lcs[li])) {
      result.push({ type: "added", text: newLines[ni] });
      ni++;
    }
  }

  return result;
}

export function ScriptDiffDialog({ open, onOpenChange, versions, initialLeftId, initialRightId }: ScriptDiffDialogProps) {
  const [leftId, setLeftId] = useState(initialLeftId || versions[1]?.id || "");
  const [rightId, setRightId] = useState(initialRightId || versions[0]?.id || "");

  const leftVersion = versions.find((v) => v.id === leftId);
  const rightVersion = versions.find((v) => v.id === rightId);

  const diff = leftVersion && rightVersion ? diffLines(leftVersion.script, rightVersion.script) : [];

  const added = diff.filter((d) => d.type === "added").length;
  const removed = diff.filter((d) => d.type === "removed").length;
  const unchanged = diff.filter((d) => d.type === "same").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comparaison des versions</DialogTitle>
          <DialogDescription>Visualisez les différences entre deux versions du script</DialogDescription>
        </DialogHeader>

        {/* Version selectors */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Ancienne version</label>
            <Select value={leftId} onValueChange={setLeftId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id} disabled={v.id === rightId}>
                    v{v.version_number} — {format(new Date(v.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowRight className="h-4 w-4 text-muted-foreground mt-5 shrink-0" />

          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nouvelle version</label>
            <Select value={rightId} onValueChange={setRightId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id} disabled={v.id === leftId}>
                    v{v.version_number} — {format(new Date(v.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <Plus className="h-3 w-3" /> {added} ajouté{added > 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <Minus className="h-3 w-3" /> {removed} supprimé{removed > 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Equal className="h-3 w-3" /> {unchanged} inchangé{unchanged > 1 ? "s" : ""}
          </span>
        </div>

        {/* Diff view */}
        <ScrollArea className="flex-1 min-h-0 rounded-lg border">
          <div className="p-4 font-mono text-sm space-y-0.5">
            {diff.length === 0 && (
              <p className="text-muted-foreground text-center py-8">Sélectionnez deux versions différentes pour voir les changements</p>
            )}
            {diff.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  "px-3 py-1 rounded-sm whitespace-pre-wrap",
                  line.type === "added" && "bg-green-500/10 text-green-700 dark:text-green-400 border-l-2 border-green-500",
                  line.type === "removed" && "bg-red-500/10 text-red-700 dark:text-red-400 border-l-2 border-red-500 line-through opacity-70",
                  line.type === "same" && "text-foreground/70"
                )}
              >
                <span className="select-none text-muted-foreground/50 mr-3 inline-block w-4 text-right">
                  {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
                </span>
                {line.text || "\u00A0"}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
