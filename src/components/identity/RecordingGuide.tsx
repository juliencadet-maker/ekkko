import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Video, Mic, Eye } from "lucide-react";
import recordingDoImg from "@/assets/recording-do.jpg";
import recordingDontImg from "@/assets/recording-dont.jpg";

interface RecordingGuideProps {
  onStartRecording: () => void;
}

const TIPS = [
  { text: "Parlez avec énergie — voix expressive = avatar expressif", positive: true },
  { text: "Gardez une position stable dans le cadre", positive: true },
  { text: "Regardez directement la caméra", positive: true },
  { text: "Éclairage naturel, face à une fenêtre de préférence", positive: true },
  { text: "Environnement calme pour un clonage vocal optimal", positive: true },
  { text: "Arrière-plan dégagé et neutre", positive: false },
  { text: "Pas de casque ni d'écouteurs visibles", positive: false },
  { text: "Évitez les mouvements brusques de la tête", positive: false },
];

export function RecordingGuide({ onStartRecording }: RecordingGuideProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Enregistrez votre vidéo de référence</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Cette vidéo unique servira à créer votre avatar visuel et à cloner votre voix. 
          Un téléprompter vous guidera pendant l'enregistrement.
        </p>
      </div>

      {/* What we capture */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2.5 p-3 bg-muted/50 rounded-lg border">
          <Eye className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Clone visuel</p>
            <p className="text-xs text-muted-foreground">Votre apparence & expressions</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-3 bg-muted/50 rounded-lg border">
          <Mic className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Clone vocal</p>
            <p className="text-xs text-muted-foreground">Votre timbre & intonation</p>
          </div>
        </div>
      </div>

      {/* DO / DON'T images */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border">
        <div className="relative rounded-lg overflow-hidden">
          <img src={recordingDoImg} alt="Bon exemple d'enregistrement" className="w-full aspect-video object-cover" />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            <CheckCircle2 className="h-3.5 w-3.5" />
            À FAIRE
          </div>
        </div>
        <div className="relative rounded-lg overflow-hidden">
          <img src={recordingDontImg} alt="Mauvais exemple d'enregistrement" className="w-full aspect-video object-cover" />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            <XCircle className="h-3.5 w-3.5" />
            À ÉVITER
          </div>
        </div>
      </div>

      {/* Tips list */}
      <div className="space-y-2.5">
        {TIPS.map((tip, index) => (
          <div key={index} className="flex items-start gap-2.5">
            {tip.positive ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            )}
            <span className="text-sm">{tip.text}</span>
          </div>
        ))}
      </div>

      {/* Start recording CTA */}
      <div className="flex justify-center pt-2">
        <Button onClick={onStartRecording} size="lg" className="gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          Démarrer l'enregistrement
        </Button>
      </div>
    </div>
  );
}
