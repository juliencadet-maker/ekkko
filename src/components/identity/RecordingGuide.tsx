import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  XCircle, 
} from "lucide-react";
import framingGood from "@/assets/framing-good.png";
import framingBad from "@/assets/framing-bad.png";

interface RecordingGuideProps {
  onStartRecording: () => void;
}

const DO_TIPS = [
  "Position assise, cadrage buste (style Zoom)",
  "Regard direct vers la caméra, tête stable",
  "Éclairage diffus, face à une fenêtre de préférence",
  "Cou et mâchoire entièrement visibles",
  "Cheveux derrière les épaules, pas sur le visage",
  "Micro intégré de l'appareil (pas d'AirPods/casque)",
  "Articulez bien — dents visibles quand vous parlez",
  "Environnement calme, arrière-plan fixe et neutre",
];

const DONT_TIPS = [
  "Pas de casque, écouteurs ou micro externe visible",
  "Pas de col haut ni de vêtement cachant le cou",
  "Pas de bijoux (collier, boucles d'oreilles, lunettes)",
  "Pas de gestes des mains ni mouvements brusques",
  "Pas de suppression de bruit ou effets audio",
  "Ne tournez pas la tête, restez face à la caméra",
];

export function RecordingGuide({ onStartRecording }: RecordingGuideProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Préparez votre enregistrement</h3>
        <p className="text-sm text-muted-foreground mt-1">
          L'enregistrement dure environ <strong>2 minutes</strong>. 
          Un téléprompter vous guidera à chaque étape. Avant de commencer, 
          vérifiez ces quelques conseils.
        </p>
      </div>

      {/* Visual framing examples */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center gap-2 p-3 rounded-lg border border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/20">
          <img src={framingGood} alt="Bon cadrage" loading="lazy" width={160} height={160} className="rounded-md" />
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Bon cadrage
          </span>
        </div>
        <div className="flex flex-col items-center gap-2 p-3 rounded-lg border border-red-200/50 dark:border-red-800/30 bg-red-50/50 dark:bg-red-950/20">
          <img src={framingBad} alt="Mauvais cadrage" loading="lazy" width={160} height={160} className="rounded-md" />
          <span className="text-xs font-semibold text-red-500 dark:text-red-400 flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" /> Mauvais cadrage
          </span>
        </div>
      </div>

      {/* DO / DON'T tips */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2.5 p-4 rounded-lg border border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/20">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> À faire
          </h4>
          {DO_TIPS.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span className="text-xs leading-relaxed">{tip}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2.5 p-4 rounded-lg border border-red-200/50 dark:border-red-800/30 bg-red-50/50 dark:bg-red-950/20">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-red-500 dark:text-red-400">
            <XCircle className="h-4 w-4" /> À éviter
          </h4>
          {DONT_TIPS.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
              <span className="text-xs leading-relaxed">{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Start recording CTA */}
      <div className="flex justify-center pt-2">
        <Button onClick={onStartRecording} size="lg" className="gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          C'est parti !
        </Button>
      </div>
    </div>
  );
}
