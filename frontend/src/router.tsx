import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import type { JSX } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { OverviewPage } from "@/routes/overview";
import { LogisticsPage } from "@/routes/logistics";
import { PatientsPage } from "@/routes/patients";
import { PatientPage } from "@/routes/patient";
import { RoomPage } from "@/routes/room";
import { EmployeesPage } from "@/routes/employees";
import { FinancialPage } from "@/routes/financial";

const rootRoute = createRootRoute({ component: AppShell });
const route = <TPath extends string>(path: TPath, component: () => JSX.Element) =>
  createRoute({ getParentRoute: () => rootRoute, path, component });

const routeTree = rootRoute.addChildren([
  route("/", OverviewPage),
  route("/logistics", LogisticsPage),
  route("/patients", PatientsPage),
  route("/patients/$patientId", PatientPage),
  route("/rooms/$roomId", RoomPage),
  route("/employees", EmployeesPage),
  route("/financial", FinancialPage),
]);

export const router = createRouter({ routeTree });
declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
