import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthContext } from "@/contexts/AuthContext";

export default function Settings() {
  const { profile, org } = useAuthContext();
  return (
    <AppLayout>
      <PageHeader title="Paramètres" description="Configuration de votre organisation" />
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Organisation</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><span className="text-muted-foreground">Nom:</span> {org?.name}</p>
              <p><span className="text-muted-foreground">Identifiant:</span> {org?.slug}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Profil</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><span className="text-muted-foreground">Nom:</span> {profile?.first_name} {profile?.last_name}</p>
              <p><span className="text-muted-foreground">Email:</span> {profile?.email}</p>
              <p><span className="text-muted-foreground">Fonction:</span> {profile?.title}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
