import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/logistics", label: "Logistics" },
  { to: "/patients", label: "Patients" },
  { to: "/employees", label: "Employees" },
  { to: "/financial", label: "Financial" },
] as const;

export function SidebarNav() {
  return (
    <aside className="flex w-56 flex-col border-r bg-card">
      <div className="px-5 py-4">
        <div className="text-sm font-semibold">Uniklikum X</div>
        <div className="text-xs text-muted-foreground">Command Center</div>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            activeProps={{ className: cn("bg-accent font-medium text-foreground") }}
            activeOptions={{ exact: n.to === "/" }}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
