import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { postData } from "@/lib/api/client";

export function TopBar() {
  const [now, setNow] = useState(() => new Date());
  const fetching = useIsFetching();
  const qc = useQueryClient();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function reseed() {
    try {
      await postData("/v1/database-seeds");
      await qc.invalidateQueries();
      toast.success("Hospital demo data reseeded");
    } catch {
      toast.error("Reseed failed — is the backend running?");
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-2">
        <Badge variant={fetching ? "default" : "secondary"} className="gap-1">
          <span className={`h-2 w-2 rounded-full ${fetching ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
          {fetching ? "LIVE · syncing" : "LIVE"}
        </Badge>
        <span className="text-sm tabular-nums text-muted-foreground">
          {now.toLocaleTimeString("de-DE")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries()}>Refresh</Button>
        <Button size="sm" onClick={reseed}>Reseed demo data</Button>
      </div>
    </header>
  );
}
