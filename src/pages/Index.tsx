import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { EkkoLogo } from "@/components/ui/EkkoLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Clock,
  Zap,
  Briefcase,
  Sparkles,
  Send,
  Eye,
  Check,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const CALENDLY_URL = "https://calendly.com/julien-cadet-getekko/discovery-call";

const POSTES = [
  "Account Executive",
  "Account Executive Senior",
  "VP Sales",
  "Head of Sales",
  "CRO",
  "Sales Enablement",
  "Sales Ops / RevOps",
  "Autre",
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const scrollToEarlyAccess = () => {
  document.getElementById("early-access")?.scrollIntoView({ behavior: "smooth" });
};

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border/50 h-16 flex items-center px-6">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <EkkoLogo size={32} textSize={22} onDark={false} />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Connexion
            </Button>
            <Button
              className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-6"
              onClick={scrollToEarlyAccess}
            >
              Rejoindre le pilote
            </Button>
          </div>
        </div>
      </nav>

      {/* ── SECTION 1 — HERO ── */}
      <section className="py-20 lg:py-28 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <FadeIn>
            <p className="text-xs font-bold text-accent uppercase tracking-[0.18em] mb-5">
              Execution amplifier · Pour AE Enterprise
            </p>
            <h1 className="text-4xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.08] mb-6">
              Vos top performers font 5 trucs que vous n'avez pas le temps de faire.
            </h1>
            <p className="text-lg text-foreground/70 max-w-xl mb-8 leading-relaxed">
              Vidéo perso à chaque sponsor, booklet exec, atelier ROI, intervention exec
              interne, suivi engagement. Tout ce qui fait gagner les gros deals — produit
              en 5 minutes au lieu d'une demi-journée.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-8 w-full sm:w-auto"
                onClick={scrollToEarlyAccess}
              >
                Rejoindre le pilote
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-primary/30 text-primary hover:bg-primary/5 px-8 w-full sm:w-auto"
                asChild
              >
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
                  Parler 20 min avec moi
                </a>
              </Button>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="grid grid-cols-2 gap-3">
              {/* AVANT */}
              <div className="rounded-2xl bg-marine-2 p-5 border border-sidebar-border">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ivory/40">
                    Avant
                  </span>
                  <Clock className="h-4 w-4 text-ivory/40" />
                </div>
                <p className="text-2xl font-bold text-ivory mb-4">2 h</p>
                <ul className="space-y-2 text-[12px] text-ivory/65 leading-snug">
                  <li>1 vidéo perso à scripter</li>
                  <li>1 booklet sur Figma</li>
                  <li>1 atelier ROI à animer</li>
                  <li>Suivi à la main dans Notion</li>
                </ul>
                <div className="mt-5 inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-destructive/15 text-destructive">
                  Tu ne le fais pas. Tu perds.
                </div>
              </div>

              {/* AVEC EKKO */}
              <div className="rounded-2xl bg-marine p-5 border-2 border-accent">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                    Avec Ekko
                  </span>
                  <Zap className="h-4 w-4 text-accent" />
                </div>
                <p className="text-2xl font-bold text-ivory mb-4">5 min</p>
                <ul className="space-y-2 text-[12px] text-ivory/80 leading-snug">
                  <li>Vidéo perso générée</li>
                  <li>Booklet exec produit</li>
                  <li>Atelier ROI exporté</li>
                  <li>Engagement tracké auto</li>
                </ul>
                <div className="mt-5 inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-accent/15 text-accent">
                  Tu le fais. Tu gagnes.
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── SECTION 2 — PROBLÈME ── */}
      <section className="py-24 lg:py-32 px-6 bg-ivory-2/40 border-y border-border/50">
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/50 mb-5">
              Le problème
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight leading-[1.15] mb-10">
              Sur 10 deals enterprise, vous avez fait quelque chose
              <br className="hidden md:inline" /> de vraiment différenciant sur combien ?
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="space-y-5 text-[17px] leading-[1.75] text-foreground/75 text-left md:text-center max-w-2xl mx-auto">
              <p>
                Si vous êtes comme la plupart des AE, la réponse honnête c'est 2 ou 3.
                Pas parce que vous ne savez pas quoi faire — vous savez. Mais entre la
                vidéo perso à scripter, l'exec à convaincre d'intervenir, le booklet à
                designer et l'atelier ROI à animer, vous faites le calcul : 2 heures de
                prod par deal × 10 deals actifs = 20 heures par semaine. Impossible.
              </p>
              <p>
                Donc vous envoyez un deck standard et un email perso, et vous espérez.
                Pendant ce temps, votre concurrent qui a pris le temps de personnaliser
                sort un cran au-dessus aux yeux du sponsor.
              </p>
              <p className="font-semibold text-foreground">
                Ce n'est pas une question de talent. C'est une question d'exécution.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── SECTION 3 — 5 CAPACITÉS ── */}
      <section className="py-24 lg:py-32 px-6 bg-marine">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-5">
              Ce que Ekko fait
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight leading-[1.15] text-ivory max-w-3xl mx-auto">
              Les 5 différenciateurs de vos top performers. Produits par Ekko.
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                num: "01",
                title: "Vidéo personnalisée",
                desc: "Vous enregistrez 30 secondes de script en audio. Ekko produit une vidéo perso au nom du prospect, ou une vidéo de votre sponsor exec avec son clone vocal. Sans planning calls, sans demi-journée bloquée.",
              },
              {
                num: "02",
                title: "Booklet exec partageable",
                desc: "Vous décrivez le deal. Ekko produit un executive summary qui se partage en un lien. Pas de PowerPoint à faire, pas de Figma à ouvrir. Déjà beau, déjà cohérent avec votre marque.",
              },
              {
                num: "03",
                title: "Atelier ROI personnalisé",
                desc: "Vous donnez les inputs du deal (volumes, douleurs identifiées, ambitions du prospect). Ekko produit un atelier ROI structuré que vous présentez en 30 min — état des lieux, projection avec vous, impact chiffré.",
              },
              {
                num: "04",
                title: "Intervention exec interne",
                desc: "Votre VP ou DG approuve en un clic une intervention sur un deal critique. Ekko produit la vidéo personnalisée avec son clone vocal. L'exec touche tous vos deals sans bloquer son agenda.",
              },
              {
                num: "05",
                title: "Suivi engagement & alignement",
                desc: "Une fois envoyé, Ekko suit qui voit, qui forward, qui réagit en interne. Vous savez où relancer, qui mobiliser, et quand activer le prochain levier. Plus de pilotage à l'aveugle.",
              },
            ].map((c, i) => (
              <FadeIn key={c.num} delay={i * 0.05}>
                <div className="group h-full rounded-2xl bg-marine-2 border border-sidebar-border p-7 transition-all duration-200 hover:border-accent hover:-translate-y-0.5">
                  <p className="text-[11px] font-bold text-ivory/35 mb-4 tracking-widest">
                    {c.num}
                  </p>
                  <h3 className="text-lg font-semibold text-ivory mb-3">{c.title}</h3>
                  <p className="text-sm text-ivory/65 leading-relaxed">{c.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4 — COMMENT ÇA MARCHE ── */}
      <section className="py-24 lg:py-32 px-6 bg-ivory-2/40 border-y border-border/50">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/50 mb-5">
              Comment ça marche
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight leading-[1.15] mb-4">
              De l'instinct à l'exécution, en 4 étapes.
            </h2>
            <p className="text-base text-foreground/60">
              Vous savez ce qu'il faut faire. Ekko le fait pour vous.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                n: 1,
                Icon: Briefcase,
                title: "Vous identifiez le moment",
                desc: "Sur un deal, vous décidez : c'est le moment d'envoyer une vidéo perso, un booklet exec, ou de proposer un atelier ROI.",
                green: true,
              },
              {
                n: 2,
                Icon: Sparkles,
                title: "Ekko produit l'asset",
                desc: "Vous donnez les inputs en 30 secondes. Ekko génère vidéo / booklet / atelier en 5 minutes.",
              },
              {
                n: 3,
                Icon: Send,
                title: "Vous envoyez en 1 clic",
                desc: "L'asset est prêt à partager : lien direct, email, ou poste LinkedIn. Pas de friction.",
              },
              {
                n: 4,
                Icon: Eye,
                title: "Ekko suit ce qui se passe",
                desc: "Qui voit, qui forward, qui réagit. Vous savez quand et qui relancer, sans deviner.",
                green: true,
              },
            ].map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.05}>
                <div className="h-full rounded-2xl bg-card border border-border p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                        s.green
                          ? "bg-accent text-accent-foreground"
                          : "bg-marine text-ivory"
                      }`}
                    >
                      {s.n}
                    </div>
                    <s.Icon className="h-5 w-5 text-foreground/40" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-foreground/60 leading-relaxed">{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5 — POUR QUI ── */}
      <section className="py-24 lg:py-32 px-6 bg-marine">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-5">
              Pour qui
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-ivory">
              Vous reconnaissez votre quotidien ?
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                label: "Utilisateur quotidien",
                labelGreen: true,
                title: "Account Executive Senior",
                desc: "Vous gérez 8 à 12 deals enterprise en parallèle. Vous savez ce qu'il faut faire pour gagner les gros — mais vous n'avez ni le temps ni les outils pour personnaliser chaque interaction.",
                bullets: [
                  "ACV 30k€+, cycles 3-12 mois",
                  "Scale-up B2B SaaS 200-2000 employés",
                  "Top 30% performer en quête d'edge",
                  "Marre de perdre face à des concurrents mieux préparés",
                ],
                highlight: true,
              },
              {
                label: "Acheteur",
                title: "VP Sales / CRO",
                desc: "Vous voyez vos AE moyens produire du deck standard pendant que vos top performers gagnent grâce à des pratiques différenciantes. Vous voulez que tous fassent comme les meilleurs — sans embaucher 10 enablement managers.",
                bullets: [
                  "Pipeline coverage > 3x quota",
                  "Forecast accuracy 75%+",
                  "Variance entre top et reste de l'équipe à réduire",
                  "Onboarding nouveaux AE accéléré",
                ],
              },
              {
                label: "Exec sponsor",
                title: "Dirigeants & Executives",
                desc: "Vos AE vous sollicitent pour intervenir sur les gros deals. Vous voulez aider — mais vous n'avez pas le temps de faire 30 vidéos perso par trimestre. Avec votre clone vocal Ekko, vous êtes présent sur chaque deal sans bloquer votre agenda.",
                bullets: [
                  "Présence sur 100% des deals stratégiques",
                  "Contrôle total sur votre image (validation explicite à chaque envoi)",
                  "5 minutes vs 30 minutes par intervention",
                  "Mesure d'impact réel sur le pipeline",
                ],
              },
            ].map((p, i) => (
              <FadeIn key={p.title} delay={i * 0.07}>
                <div
                  className={`h-full rounded-2xl p-7 border ${
                    p.highlight
                      ? "bg-marine-2 border-2 border-accent"
                      : "bg-marine-2 border-sidebar-border"
                  }`}
                >
                  <span
                    className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded mb-5 ${
                      p.labelGreen
                        ? "bg-accent/15 text-accent"
                        : "bg-ivory/10 text-ivory/55"
                    }`}
                  >
                    {p.label}
                  </span>
                  <h3 className="text-xl font-semibold text-ivory mb-3">{p.title}</h3>
                  <p className="text-sm text-ivory/65 leading-relaxed mb-5">{p.desc}</p>
                  <ul className="space-y-2.5">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-ivory/75">
                        <Check className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6 — FOUNDER ── */}
      <section className="py-24 lg:py-32 px-6 bg-ivory-2/40 border-y border-border/50">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[1.4fr_1fr] gap-12 lg:gap-16 items-center">
          <FadeIn>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/50 mb-5">
              Pourquoi je construis ça
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-8 leading-[1.15]">
              L'outil que j'aurais voulu quand j'étais AE.
            </h2>
            <div className="space-y-4 text-[16px] leading-[1.7] text-foreground/75">
              <p>Je m'appelle Julien.</p>
              <p>
                Pendant des années, j'ai fait exactement ce que Ekko fait aujourd'hui :
                vidéo personnalisée à chaque sponsor clé, booklet exec à chaque
                proposition stratégique, atelier ROI sur les gros deals, intervention de
                mes execs au bon moment.
              </p>
              <p>
                Ça m'a fait gagner des deals que mes collègues perdaient. Ça a été
                partagé en best practice au Sales Club et appliqué par d'autres équipes.
              </p>
              <p>
                Mais ça m'a coûté mes soirées et mes weekends. Et autour de moi, ceux
                qui voulaient le faire abandonnaient — pas par incompétence, par manque
                de temps.
              </p>
              <p className="font-semibold text-foreground">
                Ekko, c'est cet outil. Si vous voulez qu'on en parle avant le lancement,
                prenez 20 minutes.
              </p>
            </div>
            <div className="mt-8">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-primary/30 text-primary hover:bg-primary/5 px-8"
                asChild
              >
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
                  Parler 20 min avec moi
                </a>
              </Button>
            </div>
          </FadeIn>

          <FadeIn delay={0.15} className="flex justify-center md:justify-end">
            <div className="w-[240px] h-[240px] lg:w-[280px] lg:h-[280px] rounded-full bg-gradient-to-br from-marine-3 to-marine flex items-center justify-center text-ivory/40 border border-border">
              <span className="text-sm">Photo Julien</span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── SECTION 7 — EARLY ACCESS ── */}
      <EarlyAccessSection />

      {/* ── SECTION 8 — FOOTER ── */}
      <footer className="bg-marine text-ivory px-6 py-16">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-10 mb-10">
          <div>
            <EkkoLogo size={28} textSize={20} onDark={true} />
            <p className="text-sm text-ivory/55 mt-3 leading-relaxed">
              Execution amplifier pour AE enterprise.
            </p>
          </div>
          <FooterCol
            title="Produit"
            links={[
              { label: "Fonctionnalités", href: "#" },
              { label: "Tarifs (bientôt)", href: "#" },
              { label: "Sécurité", href: "#" },
            ]}
          />
          <FooterCol
            title="Légal"
            links={[
              { label: "Mentions", href: "#" },
              { label: "Confidentialité", href: "#" },
              { label: "CGU", href: "#" },
            ]}
          />
          <FooterCol
            title="Contact"
            links={[
              { label: "julien.cadet@getekko.eu", href: "mailto:julien.cadet@getekko.eu" },
              { label: "LinkedIn", href: "https://www.linkedin.com/in/juliencadet/" },
            ]}
          />
        </div>
        <div className="max-w-6xl mx-auto pt-8 border-t border-sidebar-border text-center text-xs text-ivory/40">
          © 2026 Ekko. Bâti à Paris.
        </div>
      </footer>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-ivory/40 mb-4">
        {title}
      </p>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="text-sm text-ivory/75 hover:text-accent transition-colors"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────── Early access form ─────────── */

type FormState = "idle" | "loading" | "success" | "error";

function EarlyAccessSection() {
  const [state, setState] = useState<FormState>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [submittedFirstName, setSubmittedFirstName] = useState<string>("");

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [poste, setPoste] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrMsg(null);

    if (!prenom.trim() || !nom.trim() || !email.trim() || !entreprise.trim() || !poste) {
      setErrMsg("Merci de remplir tous les champs.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrMsg("Email invalide.");
      return;
    }

    setState("loading");
    try {
      const { error } = await supabase.functions.invoke("early-access-signup", {
        body: {
          prenom: prenom.trim(),
          nom: nom.trim(),
          email: email.trim().toLowerCase(),
          entreprise: entreprise.trim(),
          poste,
        },
      });
      if (error) throw error;
      setSubmittedFirstName(prenom.trim());
      setState("success");
    } catch (err) {
      console.error("[early-access] submit failed", err);
      setState("error");
      setErrMsg(
        "Oops, ça n'a pas marché. Réessayez ou écrivez à julien@getekko.eu"
      );
    }
  };

  return (
    <section
      id="early-access"
      className="py-28 lg:py-40 px-6 bg-gradient-to-b from-accent/5 via-accent/10 to-accent/5"
    >
      <div className="max-w-2xl mx-auto text-center">
        <FadeIn>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary mb-5">
            Rejoindre le pilote
          </p>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight leading-[1.15] mb-5">
            On lance le pilote avec 20 AE triés sur le volet.
          </h2>
          <p className="text-base text-foreground/65 max-w-xl mx-auto mb-12">
            Pas de bullshit, pas d'engagement. Si vous êtes AE enterprise et que vous
            voulez tester en avant-première, on vous écrit dès que le pilote ouvre.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          {state === "success" ? (
            <div className="bg-card rounded-2xl p-10 shadow-card border border-border max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Merci {submittedFirstName}, c'est noté.
              </h3>
              <p className="text-sm text-foreground/65 mb-6 leading-relaxed">
                On vous écrit dès que le pilote ouvre. En attendant, si vous voulez
                échanger 20 min :
              </p>
              <Button
                className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold px-8"
                asChild
              >
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
                  Réserver 20 min
                </a>
              </Button>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="bg-card rounded-2xl p-7 lg:p-9 shadow-card border border-border max-w-lg mx-auto text-left"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Prénom"
                  required
                  value={prenom}
                  onChange={setPrenom}
                  placeholder="Marie"
                  autoComplete="given-name"
                />
                <Field
                  label="Nom"
                  required
                  value={nom}
                  onChange={setNom}
                  placeholder="Dupont"
                  autoComplete="family-name"
                />
              </div>
              <Field
                label="Email pro"
                required
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="marie@entreprise.com"
                autoComplete="email"
                className="mt-4"
              />
              <Field
                label="Entreprise"
                required
                value={entreprise}
                onChange={setEntreprise}
                placeholder="Spendesk, Pigment, etc."
                autoComplete="organization"
                className="mt-4"
              />
              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/55 mb-2">
                  Poste <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  value={poste}
                  onChange={(e) => setPoste(e.target.value)}
                  className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  <option value="" disabled>
                    Sélectionnez votre poste
                  </option>
                  {POSTES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {errMsg && (
                <p className="mt-4 text-sm text-destructive font-medium">{errMsg}</p>
              )}

              <Button
                type="submit"
                disabled={state === "loading"}
                className="mt-6 w-full h-12 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base"
              >
                {state === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Je veux être prévenu"
                )}
              </Button>
              <p className="mt-4 text-xs text-foreground/50 text-center">
                Vous recevez 1 email quand on est prêt. C'est tout. Pas de spam.
              </p>
            </form>
          )}
        </FadeIn>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  autoComplete,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/55 mb-2">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </div>
  );
}
