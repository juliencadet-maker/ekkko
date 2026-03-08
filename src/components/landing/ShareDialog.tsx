import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, Plus, Trash2, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Collaborator {
  first_name: string;
  last_name: string;
  email: string;
  title: string;
}

const emptyCollaborator = (): Collaborator => ({
  first_name: "",
  last_name: "",
  email: "",
  title: "",
});

interface ShareDialogProps {
  videoId: string;
  campaignId: string;
  senderName: string;
  senderViewerHash: string;
  brandColor: string;
}

export function ShareDialog({
  videoId,
  campaignId,
  senderName,
  senderViewerHash,
  brandColor,
}: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([
    emptyCollaborator(),
  ]);
  const [isSending, setIsSending] = useState(false);

  const addCollaborator = () => {
    setCollaborators((prev) => [...prev, emptyCollaborator()]);
  };

  const removeCollaborator = (index: number) => {
    if (collaborators.length <= 1) return;
    setCollaborators((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCollaborator = (
    index: number,
    field: keyof Collaborator,
    value: string
  ) => {
    setCollaborators((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const isValid = collaborators.every(
    (c) => c.first_name.trim() && c.last_name.trim() && c.email.trim()
  );

  const handleSend = async () => {
    if (!isValid) {
      toast.error("Veuillez remplir nom, prénom et email pour chaque collaborateur");
      return;
    }

    setIsSending(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(
        `${supabaseUrl}/functions/v1/send-share-invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            video_id: videoId,
            campaign_id: campaignId,
            sender_name: senderName,
            sender_viewer_hash: senderViewerHash,
            collaborators: collaborators.map((c) => ({
              first_name: c.first_name.trim(),
              last_name: c.last_name.trim(),
              email: c.email.trim(),
              title: c.title.trim() || undefined,
            })),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erreur serveur");

      const successCount = data.results?.filter(
        (r: { success: boolean }) => r.success
      ).length;
      toast.success(
        `Invitation${successCount > 1 ? "s" : ""} envoyée${successCount > 1 ? "s" : ""} à ${successCount} collaborateur${successCount > 1 ? "s" : ""}`
      );
      setOpen(false);
      setCollaborators([emptyCollaborator()]);
    } catch {
      console.error("Share failed");
      toast.error("Erreur lors de l'envoi des invitations");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-2"
          style={{ borderColor: brandColor, color: brandColor }}
        >
          <Share2 className="h-4 w-4" />
          Partager à un collaborateur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Partager cette vidéo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {collaborators.map((collab, index) => (
            <div
              key={index}
              className="space-y-3 p-4 rounded-lg border bg-muted/30 relative"
            >
              {collaborators.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCollaborator(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <p className="text-xs font-medium text-muted-foreground">
                Collaborateur {index + 1}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Prénom *</Label>
                  <Input
                    placeholder="Jean"
                    value={collab.first_name}
                    onChange={(e) =>
                      updateCollaborator(index, "first_name", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Nom *</Label>
                  <Input
                    placeholder="Dupont"
                    value={collab.last_name}
                    onChange={(e) =>
                      updateCollaborator(index, "last_name", e.target.value)
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  placeholder="jean.dupont@entreprise.com"
                  value={collab.email}
                  onChange={(e) =>
                    updateCollaborator(index, "email", e.target.value)
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Titre / Poste</Label>
                <Input
                  placeholder="Directeur Financier"
                  value={collab.title}
                  onChange={(e) =>
                    updateCollaborator(index, "title", e.target.value)
                  }
                />
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={addCollaborator}
          >
            <Plus className="h-4 w-4" />
            Ajouter un collaborateur
          </Button>

          <Button
            className="w-full gap-2"
            style={{ backgroundColor: brandColor }}
            onClick={handleSend}
            disabled={!isValid || isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSending
              ? "Envoi en cours..."
              : `Envoyer ${collaborators.length > 1 ? `les ${collaborators.length} invitations` : "l'invitation"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
