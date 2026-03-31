import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2 } from "lucide-react";

interface WaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
}

export function WaitlistDialog({ open, onOpenChange, source = "landing" }: WaitlistDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const { error: sbError } = await (supabase as any).from("waitlist").insert({
      first_name: firstName,
      last_name: lastName,
      company,
      email,
      phone: phone || null,
      message: message || null,
      source,
    });

    if (sbError) {
      if (sbError.code === "23505") {
        setError("Cette adresse email est déjà enregistrée.");
      } else {
        setError("Une erreur est survenue. Réessayez.");
      }
    } else {
      setIsSuccess(true);
      setTimeout(() => onOpenChange(false), 3000);
    }

    setIsLoading(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setTimeout(() => {
        setFirstName("");
        setLastName("");
        setCompany("");
        setEmail("");
        setPhone("");
        setMessage("");
        setIsLoading(false);
        setIsSuccess(false);
        setError("");
      }, 200);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Demander l'accès à Ekko</DialogTitle>
          <DialogDescription>
            Nous vous contacterons sous 48h. Aucun accès automatique — nous lisons chaque demande personnellement.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-accent mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Demande reçue !</p>
            <p className="text-sm text-muted-foreground">
              Nous vous contacterons sous 48h à l'adresse {email}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wl-firstname">Prénom *</Label>
                <Input
                  id="wl-firstname"
                  required
                  placeholder="Jean"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wl-lastname">Nom *</Label>
                <Input
                  id="wl-lastname"
                  required
                  placeholder="Dupont"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-company">Entreprise *</Label>
              <Input
                id="wl-company"
                required
                placeholder="Votre entreprise"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-email">Email professionnel *</Label>
              <Input
                id="wl-email"
                type="email"
                required
                placeholder="vous@entreprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-phone">Téléphone</Label>
              <Input
                id="wl-phone"
                type="tel"
                placeholder="+33 6 00 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-message">Message</Label>
              <Textarea
                id="wl-message"
                rows={4}
                placeholder="Une question, un contexte particulier, un deal en cours... On lit tout."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full rounded-full bg-primary text-accent font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                "Demander l'accès"
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Vos données ne sont jamais partagées.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
