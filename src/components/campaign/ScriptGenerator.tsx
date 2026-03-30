import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, Wand2 } from "lucide-react";

const TONE_OPTIONS = [
  { value: "professionnel", label: "Professionnel" },
  { value: "amical", label: "Amical et chaleureux" },
  { value: "dynamique", label: "Dynamique et énergique" },
  { value: "expert", label: "Expert et autoritaire" },
  { value: "empathique", label: "Empathique et à l'écoute" },
];

// Objectif = stages du cycle de vente
const PURPOSE_OPTIONS = [
  { value: "qualification", label: "Qualification" },
  { value: "rfp", label: "RFP" },
  { value: "shortlist", label: "Shortlist" },
  { value: "negotiation", label: "Négociation" },
  { value: "close", label: "Close" },
  { value: "followup", label: "Suivi / Relance" },
  { value: "autre", label: "Autre" },
];

interface RecipientData {
  firstName: string;
  company: string;
}

interface ScriptGeneratorProps {
  onScriptGenerated: (script: string, recipientData?: RecipientData) => void;
  senderName: string;
  senderTitle: string;
}

export function ScriptGenerator({ onScriptGenerated, senderName, senderTitle }: ScriptGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [context, setContext] = useState({
    recipientName: "",
    recipientCompany: "",
    purpose: "",
    tone: "professionnel",
    keyPoint1: "",
    keyPoint2: "",
    keyPoint3: "",
    callToAction: "",
  });
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!context.purpose) {
      toast({ title: "Objectif requis", description: "Veuillez sélectionner l'objectif de la vidéo", variant: "destructive" });
      return;
    }

    const keyPoints = [context.keyPoint1, context.keyPoint2, context.keyPoint3].filter(Boolean).join("\n");
    if (!keyPoints.trim()) {
      toast({ title: "Points clés requis", description: "Veuillez indiquer au moins un point clé", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-script", {
        body: {
          context: {
            ...context,
            keyPoints,
            senderName,
            senderTitle,
          },
        },
      });

      if (error) throw error;
      if (data?.error) { toast({ title: "Erreur", description: data.error, variant: "destructive" }); return; }

      if (data?.script) {
        onScriptGenerated(data.script, data.recipientData);
        setIsOpen(false);
        toast({
          title: "Script généré !",
          description: data.recipientData?.firstName 
            ? "Le script et les informations du destinataire ont été ajoutés."
            : "Le script a été ajouté. Vous pouvez le modifier si nécessaire.",
        });
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de générer le script. Réessayez.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" type="button" className="gap-2" size="sm">
          <Sparkles className="h-3.5 w-3.5" />
          Générer avec l'IA
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-accent" />
            Assistant de rédaction
          </SheetTitle>
          <SheetDescription>
            Répondez à quelques questions pour générer un script personnalisé
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-6">
          {/* Purpose — deal stages */}
          <div className="space-y-2">
            <Label>Objectif de la vidéo *</Label>
            <Select value={context.purpose} onValueChange={(value) => setContext({ ...context, purpose: value })}>
              <SelectTrigger><SelectValue placeholder="Sélectionnez l'objectif" /></SelectTrigger>
              <SelectContent>
                {PURPOSE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <Label>Ton du message</Label>
            <Select value={context.tone} onValueChange={(value) => setContext({ ...context, tone: value })}>
              <SelectTrigger><SelectValue placeholder="Sélectionnez le ton" /></SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3 Key Points */}
          <div className="space-y-3">
            <Label>Points clés à mentionner *</Label>
            <Input
              value={context.keyPoint1}
              onChange={(e) => setContext({ ...context, keyPoint1: e.target.value })}
              placeholder="Point clé 1"
            />
            <Input
              value={context.keyPoint2}
              onChange={(e) => setContext({ ...context, keyPoint2: e.target.value })}
              placeholder="Point clé 2"
            />
            <Input
              value={context.keyPoint3}
              onChange={(e) => setContext({ ...context, keyPoint3: e.target.value })}
              placeholder="Point clé 3"
            />
          </div>

          {/* CTA */}
          <div className="space-y-2">
            <Label>Call-to-action souhaité</Label>
            <Input
              value={context.callToAction}
              onChange={(e) => setContext({ ...context, callToAction: e.target.value })}
              placeholder="Ex: Réserver une démo, Répondre à cet email..."
            />
          </div>

          {/* Recipient info */}
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground">
              Destinataire : ces informations seront intégrées dans le script
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={context.recipientName}
                onChange={(e) => setContext({ ...context, recipientName: e.target.value })}
                placeholder="Prénom exemple"
              />
              <Input
                value={context.recipientCompany}
                onChange={(e) => setContext({ ...context, recipientCompany: e.target.value })}
                placeholder="Entreprise exemple"
              />
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2 rounded-cta bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Génération en cours...</>
            ) : (
              <><Sparkles className="h-4 w-4" />Générer le script</>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Le script généré utilisera les variables {"{prénom}"}, {"{nom}"} et {"{entreprise}"} pour la personnalisation automatique
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
