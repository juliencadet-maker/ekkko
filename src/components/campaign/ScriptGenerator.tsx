import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const PURPOSE_OPTIONS = [
  { value: "prospection", label: "Prospection commerciale" },
  { value: "followup", label: "Suivi / Relance" },
  { value: "demo", label: "Proposition de démo" },
  { value: "introduction", label: "Prise de contact" },
  { value: "remerciement", label: "Remerciement" },
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
    keyPoints: "",
    callToAction: "",
  });
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!context.purpose) {
      toast({
        title: "Objectif requis",
        description: "Veuillez sélectionner l'objectif de la vidéo",
        variant: "destructive",
      });
      return;
    }

    if (!context.keyPoints.trim()) {
      toast({
        title: "Points clés requis",
        description: "Veuillez indiquer les points clés à mentionner",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-script", {
        body: {
          context: {
            ...context,
            senderName,
            senderTitle,
          },
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Erreur",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      if (data?.script) {
        // Pass both script and recipient data to parent
        onScriptGenerated(data.script, data.recipientData);
        setIsOpen(false);
        
        const hasRecipientData = data.recipientData?.firstName || data.recipientData?.company;
        toast({
          title: "Script généré !",
          description: hasRecipientData 
            ? "Le script et les informations du destinataire ont été ajoutés."
            : "Le script a été ajouté. Vous pouvez le modifier si nécessaire.",
        });
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le script. Réessayez.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" type="button" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Générer avec l'IA
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Assistant de rédaction
          </SheetTitle>
          <SheetDescription>
            Répondez à quelques questions pour générer un script personnalisé
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Purpose */}
          <div className="space-y-2">
            <Label>Objectif de la vidéo *</Label>
            <Select
              value={context.purpose}
              onValueChange={(value) => setContext({ ...context, purpose: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez l'objectif" />
              </SelectTrigger>
              <SelectContent>
                {PURPOSE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <Label>Ton du message</Label>
            <Select
              value={context.tone}
              onValueChange={(value) => setContext({ ...context, tone: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez le ton" />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Key Points */}
          <div className="space-y-2">
            <Label htmlFor="keyPoints">Points clés à mentionner *</Label>
            <Textarea
              id="keyPoints"
              value={context.keyPoints}
              onChange={(e) => setContext({ ...context, keyPoints: e.target.value })}
              placeholder="Ex: Notre solution permet de réduire les coûts de 30%, intégration en 2 jours, support 24/7..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Listez les arguments ou informations importantes à inclure
            </p>
          </div>

          {/* Call to Action */}
          <div className="space-y-2">
            <Label htmlFor="callToAction">Call-to-action souhaité</Label>
            <Input
              id="callToAction"
              value={context.callToAction}
              onChange={(e) => setContext({ ...context, callToAction: e.target.value })}
              placeholder="Ex: Réserver une démo, Répondre à cet email, Visiter notre site..."
            />
          </div>

          {/* Optional: Recipient info for preview */}
          <div className="space-y-4 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground">
              Optionnel : Prévisualisation avec un destinataire exemple
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recipientName">Prénom exemple</Label>
                <Input
                  id="recipientName"
                  value={context.recipientName}
                  onChange={(e) => setContext({ ...context, recipientName: e.target.value })}
                  placeholder="Marie"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipientCompany">Entreprise exemple</Label>
                <Input
                  id="recipientCompany"
                  value={context.recipientCompany}
                  onChange={(e) => setContext({ ...context, recipientCompany: e.target.value })}
                  placeholder="TechCorp"
                />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full gap-2"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Générer le script
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Le script généré utilisera les variables {"{prénom}"}, {"{nom}"} et {"{entreprise}"} 
            pour la personnalisation automatique
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
