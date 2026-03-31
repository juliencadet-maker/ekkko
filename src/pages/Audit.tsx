import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { canManageOrg } from "@/lib/roles";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Loader2, ShieldOff } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { AuditLog } from "@/types/database";
import { AUDIT_EVENT_LABELS } from "@/lib/constants";

export default function Audit() {
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const { membership } = useAuthContext();
  const userRole = membership?.role || "org_user";

  useEffect(() => {
    const fetchLogs = async () => {
      if (!membership?.org_id) return;
      const { data } = await supabase.from("audit_logs").select("*").eq("org_id", membership.org_id).order("created_at", { ascending: false }).limit(100);
      setLogs(data as AuditLog[] || []);
      setIsLoading(false);
    };
    fetchLogs();
  }, [membership?.org_id]);

  const exportCSV = () => {
    const csv = [["Date", "Événement", "Type entité", "ID entité"].join(","), ...logs.map(l => [format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss"), AUDIT_EVENT_LABELS[l.event_type] || l.event_type, l.entity_type || "", l.entity_id || ""].join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit_logs.csv"; a.click();
  };

  if (!canManageOrg(userRole)) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <ShieldOff className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            Accès réservé aux administrateurs de l'organisation.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Journal d'audit" description="Traçabilité complète des actions" actions={<Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Exporter CSV</Button>} />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Événement</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">{format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}</TableCell>
                    <TableCell>{AUDIT_EVENT_LABELS[log.event_type] || log.event_type}</TableCell>
                    <TableCell className="text-muted-foreground">{log.entity_type || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
