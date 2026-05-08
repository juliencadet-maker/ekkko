import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  pickTemplatesForContext,
  fillTemplate,
  RELANCE_TEMPLATES,
  type RelanceTemplate,
} from "@/lib/relanceTemplates";
import { cn } from "@/lib/utils";

interface RelanceTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: {
    daysSinceLastSignal?: number | null;
    trajectory?: string | null;
    hasBlocker?: boolean;
    newSignalRecent?: boolean;
    multiThread?: boolean;
    stageGap?: boolean;
  };
  vars: { prenom?: string; deal?: string; contact?: string };
}

export function RelanceTemplateDialog({
  open,
  onOpenChange,
  context,
  vars,
}: RelanceTemplateDialogProps) {
  const { toast } = useToast();
  const sorted = useMemo(() => {
    const ctx = pickTemplatesForContext(context);
    // dedup
    const ids = new Set<string>();
    return ctx.filter((t) => (ids.has(t.id) ? false : (ids.add(t.id), true)));
  }, [context]);
  const [selected, setSelected] = useState<RelanceTemplate>(sorted[0] || RELANCE_TEMPLATES[0]);
  const [body, setBody] = useState(fillTemplate(selected.body, vars));
  const [copied, setCopied] = useState(false);

  const handleSelect = (t: RelanceTemplate) => {
    setSelected(t);
    setBody(fillTemplate(t.body, vars));
    setCopied(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    toast({ title: "Message copié", description: "Collez-le dans votre email." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Templates de relance
          </DialogTitle>
          <DialogDescription>
            Sélection automatique selon le contexte du deal. Personnalisez avant envoi.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 space-y-1 max-h-80 overflow-y-auto">
            {sorted.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className={cn(
                  "w-full text-left text-xs px-2 py-2 rounded transition-colors border",
                  selected.id === t.id
                    ? "bg-marine text-ivory border-marine"
                    : "border-border hover:bg-muted/40"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="md:col-span-2 space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <Button onClick={handleCopy} className="w-full">
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copié" : "Copier le message"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
