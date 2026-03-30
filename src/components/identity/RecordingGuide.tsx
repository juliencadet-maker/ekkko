import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  Mic, 
  Eye, 
  Clock, 
  Monitor,
  Volume2,
  Smile,
  MessageSquare,
  EarOff,
  ShieldCheck,
  Timer
} from "lucide-react";

interface RecordingGuideProps {
  onStartRecording: () => void;
}

const PHASES = [
  {
    step: 1,
    icon: ShieldCheck,
    title: "Consentement (en anglais)",
    duration: "~15 sec",
    description: "Lisez la phrase de consentement affichée à l'écran. C'est une obligation légale de Tavus.",
    color: "text-amber-500",
  },
  {
    step: 2,
    icon: MessageSquare,
    title: "Parole libre",
    duration: "~1 min",
    description: "Parlez naturellement en suivant le script affiché. Articulez clairement, montrez vos dents quand vous parlez.",
    color: "text-primary",
  },
  {
    step: 3,
    icon: EarOff,
    title: "Écoute silencieuse",
    duration: "~1 min",
    description: "Restez immobile, lèvres fermées, regard vers la caméra. Un sourire léger occasionnel est bienvenu.",
    color: "text-emerald-500",
  },
];

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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Créez votre avatar vidéo</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Cet enregistrement unique de <strong>2 minutes</strong> servira à créer votre clone visuel et vocal. 
          Un téléprompter vous guidera à chaque étape.
        </p>
      </div>

      {/* What we capture */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2.5 p-3 bg-muted/50 rounded-lg border">
          <Eye className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Clone visuel</p>
            <p className="text-xs text-muted-foreground">Apparence, expressions & lip-sync</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-3 bg-muted/50 rounded-lg border">
          <Mic className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Clone vocal</p>
            <p className="text-xs text-muted-foreground">Timbre, intonation & rythme</p>
          </div>
        </div>
      </div>

      {/* Recording structure: 3 phases */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Structure de l'enregistrement</h4>
          <Badge variant="secondary" className="text-xs">~2 min</Badge>
        </div>
        <div className="space-y-2">
          {PHASES.map((phase) => (
            <div key={phase.step} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted text-xs font-bold shrink-0 mt-0.5">
                {phase.step}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <phase.icon className={`h-4 w-4 ${phase.color} shrink-0`} />
                  <span className="text-sm font-medium">{phase.title}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{phase.duration}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technical requirements */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Monitor className="h-3.5 w-3.5 shrink-0" />
          Résolution min. 1080p
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          25 fps minimum
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Volume2 className="h-3.5 w-3.5 shrink-0" />
          Micro intégré uniquement
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Smile className="h-3.5 w-3.5 shrink-0" />
          Grand sourire au début
        </div>
      </div>

      {/* DO / DON'T */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> À faire
          </h4>
          {DO_TIPS.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span className="text-xs">{tip}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 text-red-500">
            <XCircle className="h-4 w-4" /> À éviter
          </h4>
          {DONT_TIPS.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
              <span className="text-xs">{tip}</span>
            </div>
          ))}
        </div>
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
