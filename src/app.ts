import { Elysia } from "elysia";
import { problem, type ProblemStatus } from "./api/problem";
import {
  decodeCursor,
  paginationFor,
  parsePageParams,
  validateQueryParams,
} from "./api/pagination";
import {
  serializeAppointment,
  serializeAppointmentType,
  serializeBed,
  serializeDepartment,
  serializeEmployee,
  serializeFloorDetail,
  serializeFloorSummary,
  serializeOpsSummary,
  serializePatientAppointmentSummary,
  serializePatient,
  serializePatientOverview,
  serializePatientSearchResult,
  serializePatientVisit,
  serializeRoom,
  serializeRoomOccupancy,
  serializeSocialSecurityNumber,
  serializeStation,
} from "./api/serializers";
import {
  validateAppointmentBookingInput,
  validateAppointmentCancellationInput,
  validateAppointmentInput,
  validateAppointmentListQuery,
  validateAppointmentRescheduleInput,
  validateAppointmentSlotSearchParams,
  validateAppointmentTypeInput,
  validateBedInput,
  validateDepartmentInput,
  validateEmployeeInput,
  validatePatientAppointmentSearchInput,
  validatePatientInput,
  validatePatientMovementAvailableBedsInput,
  validatePatientMovementCompletionInput,
  validatePatientMovementInput,
  validatePatientVisitInput,
  validateRoomInput,
  validateSocialSecurityNumberInput,
  validateStationInput,
} from "./api/validation";
import type { AppDatabase } from "./db/client";
import { resetAndSeedDatabase, seedHospitalName } from "./db/seed";
import { createHealthcareRepository } from "./repositories/healthcare";
import { respondWithStatic } from "./static";

type CreateAppOptions = {
  db: AppDatabase;
  /**
   * Absolute path to the built frontend (must contain `index.html`). When set,
   * the server also serves the SPA at `/` and its assets, keeping the API under
   * `/v1`. When omitted/null, the server runs API-only (unchanged behavior).
   */
  frontendDir?: string | null;
};

type ResponseSet = {
  status?: string | number;
  headers: Record<string, string | number | boolean | undefined>;
};

export function createApp(options: CreateAppOptions) {
  const repository = createHealthcareRepository(options.db);

  return new Elysia()
    .onBeforeHandle(({ set }) => {
      set.headers["Content-Type"] = "application/json";
    })
    .onError(({ code, error, request, set }) => {
      set.status = code === "NOT_FOUND" ? 404 : 500;
      set.headers["Content-Type"] = "application/problem+json";

      const detail =
        code === "NOT_FOUND" ? "Endpoint was not found" : "Unexpected error";

      if (set.status === 500) {
        console.error(error);
      }

      return problem(set.status as ProblemStatus, detail, new URL(request.url).pathname);
    })
    .get("/v1/health", ({ request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      return {
        data: {
          status: "OK",
        },
      };
    })
    .post("/v1/database-seeds", ({ request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const summary = resetAndSeedDatabase(options.db);

      set.status = 201;

      return {
        data: {
          hospital_name: seedHospitalName,
          reset: true,
          summary: serializeSeedSummary(summary),
        },
      };
    })
    .get("/v1/financial/summary", ({ request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const departments = repository.listDepartments(undefined, 100).data;
      // Bounded synthetic sample used ONLY to derive invoice line items below
      // (see `financialInvoices`'s doc comment) — NOT used for payer_mix,
      // which is computed over ALL patients via SQL GROUP BY (Part B fix).
      const patients = repository.listPatients(undefined, 100).data;
      const invoices = financialInvoices(departments, patients);
      const departmentFinancials = financialsByDepartment(departments);
      const revenueToday = sumBy(departmentFinancials, (row) => row.revenue);
      const costToday = sumBy(departmentFinancials, (row) => row.cost);
      const insuranceCounts = repository.countPatientsByInsuranceType();
      const insuredPatients =
        insuranceCounts.statutory + insuranceCounts.private || 1;
      const statutory = Math.round(
        (insuranceCounts.statutory / insuredPatients) * 100,
      );

      return {
        data: {
          revenue_today: revenueToday,
          revenue_mtd: revenueToday * 10,
          outstanding: sumBy(
            invoices.filter((invoice) => invoice.status !== "PAID"),
            (invoice) => invoice.amount,
          ),
          cost_today: costToday,
          margin_pct: marginPct(revenueToday, costToday),
          payer_mix: {
            statutory,
            private: 100 - statutory,
          },
        },
      };
    })
    .get("/v1/financial/revenue-trend", ({ request, set }) => {
      const query = validateRouteQuery(request, set, ["days"]);

      if (!query.ok) {
        return query.response;
      }

      const parsedDays = withValidation(
        () => parseTrendDays(query.url),
        query.url.pathname,
        set,
      );

      if (!parsedDays.ok) {
        return parsedDays.response;
      }

      const departments = repository.listDepartments(undefined, 100).data;

      return {
        data: revenueTrend(parsedDays.value, departments),
      };
    })
    .get("/v1/financial/by-department", ({ request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      return {
        data: financialsByDepartment(repository.listDepartments(undefined, 100).data),
      };
    })
    .get("/v1/financial/invoices", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => parsePageParams(url),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const params = parsedParams.value;
      const parsedAfterPublicId = withValidation(
        () => decodeCursor(params.cursor),
        url.pathname,
        set,
      );

      if (!parsedAfterPublicId.ok) {
        return parsedAfterPublicId.response;
      }

      const invoices = financialInvoices(
        repository.listDepartments(undefined, 100).data,
        repository.listPatients(undefined, 100).data,
      );
      const cursorIndex = parsedAfterPublicId.value
        ? invoices.findIndex((invoice) => invoice.id === parsedAfterPublicId.value)
        : -1;
      const rows =
        parsedAfterPublicId.value && cursorIndex === -1
          ? []
          : invoices.slice(cursorIndex + 1, cursorIndex + 1 + params.pageSize + 1);
      const page = pageGeneratedRows(rows, params.pageSize, (row) => row.id);

      return {
        data: page.data,
        pagination: paginationFor(url.pathname, params, page.nextPublicId),
      };
    })
    .get("/v1/ops/alerts", ({ request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      return {
        data: operationalAlerts(repository.listDepartments(undefined, 100).data),
      };
    })
    .get("/v1/ops/staffing", ({ request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      return {
        data: staffingByDepartment(
          repository.listDepartments(undefined, 100).data,
          repository.countEmployeesByDepartment(),
        ),
      };
    })
    .get("/v1/ops/summary", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedDate = withValidation(
        () => parseOpsSummaryDate(url),
        url.pathname,
        set,
      );

      if (!parsedDate.ok) {
        return parsedDate.response;
      }

      return {
        data: serializeOpsSummary(repository.opsSummary(parsedDate.value)),
      };
    })
    .get("/v1/ops/floors", ({ request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      return {
        data: repository.listFloors().map(serializeFloorSummary),
      };
    })
    .get("/v1/ops/floors/detail", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedQuery = withValidation(
        () => parseFloorDetailQuery(url),
        url.pathname,
        set,
      );

      if (!parsedQuery.ok) {
        return parsedQuery.response;
      }

      const detail = repository.floorDetail(
        parsedQuery.value.building,
        parsedQuery.value.level,
      );

      if (!detail) {
        return problemResponse(404, "Floor was not found", url.pathname, set);
      }

      return {
        data: serializeFloorDetail(detail),
      };
    })
    .post("/v1/social-security-numbers", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validateSocialSecurityNumberInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      const input = parsed.value;

      try {
        const created = repository.createSocialSecurityNumber({
          number: input.number,
          healthInsuranceProvider: input.health_insurance_provider,
          insuranceType: input.insurance_type,
        });

        set.status = 201;
        set.headers.Location = `/v1/social-security-numbers/${created.publicId}`;

        return {
          data: serializeSocialSecurityNumber(created),
        };
      } catch (error) {
        return handleSqlConflict(error, instance, set);
      }
    })
    .get("/v1/social-security-numbers", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => parsePageParams(url),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const params = parsedParams.value;
      const parsedAfterPublicId = withValidation(
        () => decodeCursor(params.cursor),
        url.pathname,
        set,
      );

      if (!parsedAfterPublicId.ok) {
        return parsedAfterPublicId.response;
      }

      const afterPublicId = parsedAfterPublicId.value;
      const page = repository.listSocialSecurityNumbers(
        afterPublicId,
        params.pageSize,
      );

      return {
        data: page.data.map(serializeSocialSecurityNumber),
        pagination: paginationFor(url.pathname, params, page.nextPublicId),
      };
    })
    .get("/v1/social-security-numbers/:social_security_number_id", ({
      params,
      request,
      set,
    }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const row = repository.getSocialSecurityNumber(
        params.social_security_number_id,
      );

      if (!row) {
        return problemResponse(
          404,
          "Social security number was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializeSocialSecurityNumber(row),
      };
    })
    .post("/v1/departments", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validateDepartmentInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      try {
        const created = repository.createDepartment({
          name: parsed.value.name,
          currentCapacity: parsed.value.current_capacity,
          maxCapacity: parsed.value.max_capacity,
        });

        set.status = 201;
        set.headers.Location = `/v1/departments/${created.publicId}`;

        return {
          data: serializeDepartment(created),
        };
      } catch (error) {
        return handleSqlConflict(error, instance, set);
      }
    })
    .get("/v1/departments", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => parsePageParams(url),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const params = parsedParams.value;
      const parsedAfterPublicId = withValidation(
        () => decodeCursor(params.cursor),
        url.pathname,
        set,
      );

      if (!parsedAfterPublicId.ok) {
        return parsedAfterPublicId.response;
      }

      const afterPublicId = parsedAfterPublicId.value;
      const page = repository.listDepartments(afterPublicId, params.pageSize);

      return {
        data: page.data.map(serializeDepartment),
        pagination: paginationFor(url.pathname, params, page.nextPublicId),
      };
    })
    .get("/v1/departments/:department_id", ({ params, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const row = repository.getDepartment(params.department_id);

      if (!row) {
        return problemResponse(
          404,
          "Department was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializeDepartment(row),
      };
    })
    .post("/v1/stations", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validateStationInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      const created = repository.createStation({
        name: parsed.value.name,
        stationType: parsed.value.station_type,
        departmentPublicId: parsed.value.department_id,
        building: parsed.value.building,
        floor: parsed.value.floor,
      });

      if (created.status === "DEPARTMENT_NOT_FOUND") {
        return problemResponse(404, "Department was not found", instance, set);
      }

      set.status = 201;
      set.headers.Location = `/v1/stations/${created.value.station.publicId}`;

      return {
        data: serializeStation(
          created.value.station,
          created.value.department,
        ),
      };
    })
    .get("/v1/stations", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => parsePageParams(url),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const params = parsedParams.value;
      const parsedAfterPublicId = withValidation(
        () => decodeCursor(params.cursor),
        url.pathname,
        set,
      );

      if (!parsedAfterPublicId.ok) {
        return parsedAfterPublicId.response;
      }

      const page = repository.listStations(
        parsedAfterPublicId.value,
        params.pageSize,
      );

      return {
        data: page.data.map((row) =>
          serializeStation(row.station, row.department),
        ),
        pagination: paginationFor(url.pathname, params, page.nextPublicId),
      };
    })
    .get("/v1/stations/:station_id", ({ params, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const row = repository.getStation(params.station_id);

      if (!row) {
        return problemResponse(
          404,
          "Station was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializeStation(row.station, row.department),
      };
    })
    .post("/v1/rooms", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(() => validateRoomInput(body), instance, set);

      if (!parsed.ok) {
        return parsed.response;
      }

      const created = repository.createRoom({
        name: parsed.value.name,
        roomType: parsed.value.room_type,
        departmentPublicId: parsed.value.department_id,
        stationPublicId: parsed.value.station_id,
      });

      if (created.status === "DEPARTMENT_NOT_FOUND") {
        return problemResponse(404, "Department was not found", instance, set);
      }

      if (created.status === "STATION_NOT_FOUND") {
        return problemResponse(404, "Station was not found", instance, set);
      }

      if (created.status === "INVALID_PARENT") {
        return problemResponse(
          422,
          "Station must belong to the provided department",
          instance,
          set,
        );
      }

      set.status = 201;
      set.headers.Location = `/v1/rooms/${created.value.room.publicId}`;

      return {
        data: serializeRoom(created.value),
      };
    })
    .get("/v1/rooms", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => parsePageParams(url),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const params = parsedParams.value;
      const parsedAfterPublicId = withValidation(
        () => decodeCursor(params.cursor),
        url.pathname,
        set,
      );

      if (!parsedAfterPublicId.ok) {
        return parsedAfterPublicId.response;
      }

      const page = repository.listRooms(
        parsedAfterPublicId.value,
        params.pageSize,
      );

      return {
        data: page.data.map(serializeRoom),
        pagination: paginationFor(url.pathname, params, page.nextPublicId),
      };
    })
    .get("/v1/rooms/:room_id", ({ params, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const row = repository.getRoom(params.room_id);

      if (!row) {
        return problemResponse(
          404,
          "Room was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializeRoom(row),
      };
    })
    .get("/v1/rooms/:room_id/occupancy", ({ params, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const occupancy = repository.roomOccupancy(params.room_id);

      if (!occupancy) {
        return problemResponse(
          404,
          "Room was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializeRoomOccupancy(occupancy),
      };
    })
    .post("/v1/beds", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(() => validateBedInput(body), instance, set);

      if (!parsed.ok) {
        return parsed.response;
      }

      const created = repository.createBed({
        bedType: parsed.value.bed_type,
        status: parsed.value.status,
        material: parsed.value.material,
        departmentPublicId: parsed.value.department_id,
        stationPublicId: parsed.value.station_id,
        roomPublicId: parsed.value.room_id,
      });

      if (created.status === "DEPARTMENT_NOT_FOUND") {
        return problemResponse(404, "Department was not found", instance, set);
      }

      if (created.status === "STATION_NOT_FOUND") {
        return problemResponse(404, "Station was not found", instance, set);
      }

      if (created.status === "ROOM_NOT_FOUND") {
        return problemResponse(404, "Room was not found", instance, set);
      }

      if (created.status === "INVALID_PARENT") {
        return problemResponse(
          422,
          "Room must belong to the provided department and station",
          instance,
          set,
        );
      }

      set.status = 201;
      set.headers.Location = `/v1/beds/${created.value.bed.publicId}`;

      return {
        data: serializeBed(
          created.value.bed,
          created.value.department,
          created.value.station,
          created.value.room,
        ),
      };
    })
    .get("/v1/beds", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => parsePageParams(url),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const params = parsedParams.value;
      const parsedAfterPublicId = withValidation(
        () => decodeCursor(params.cursor),
        url.pathname,
        set,
      );

      if (!parsedAfterPublicId.ok) {
        return parsedAfterPublicId.response;
      }

      const page = repository.listBeds(
        parsedAfterPublicId.value,
        params.pageSize,
      );

      return {
        data: page.data.map((row) =>
          serializeBed(row.bed, row.department, row.station, row.room),
        ),
        pagination: paginationFor(url.pathname, params, page.nextPublicId),
      };
    })
    .get("/v1/beds/:bed_id", ({ params, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const row = repository.getBed(params.bed_id);

      if (!row) {
        return problemResponse(
          404,
          "Bed was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializeBed(row.bed, row.department, row.station, row.room),
      };
    })
    .post("/v1/patient-visits", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validatePatientVisitInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      let created: ReturnType<typeof repository.createPatientVisit>;

      try {
        created = repository.createPatientVisit({
          patientNumber: parsed.value.patient_number,
          visitType: parsed.value.visit_type,
          status: parsed.value.status,
          patientPublicId: parsed.value.patient_id,
          departmentPublicId: parsed.value.department_id,
          stationPublicId: parsed.value.station_id,
          roomPublicId: parsed.value.room_id,
          bedPublicId: parsed.value.bed_id,
          startedDate: parsed.value.started_date,
          startedTime: parsed.value.started_time,
          endedDate: parsed.value.ended_date,
          endedTime: parsed.value.ended_time,
        });
      } catch (error) {
        return handleSqlConflict(error, instance, set);
      }

      if (created.status === "PATIENT_NOT_FOUND") {
        return problemResponse(404, "Patient was not found", instance, set);
      }

      if (created.status === "DEPARTMENT_NOT_FOUND") {
        return problemResponse(404, "Department was not found", instance, set);
      }

      if (created.status === "STATION_NOT_FOUND") {
        return problemResponse(404, "Station was not found", instance, set);
      }

      if (created.status === "ROOM_NOT_FOUND") {
        return problemResponse(404, "Room was not found", instance, set);
      }

      if (created.status === "BED_NOT_FOUND") {
        return problemResponse(404, "Bed was not found", instance, set);
      }

      if (created.status === "INVALID_PARENT") {
        return problemResponse(
          422,
          "Visit location must belong to the provided department, station, and room",
          instance,
          set,
        );
      }

      if (created.status === "ACTIVE_NUMBER_CONFLICT") {
        return problemResponse(
          409,
          "patient_number is already used by an active visit",
          instance,
          set,
        );
      }

      set.status = 201;
      set.headers.Location = `/v1/patient-visits/${created.value.patientVisit.publicId}`;

      return {
        data: serializePatientVisit(created.value),
      };
    })
    .get("/v1/patient-visits", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => parsePageParams(url),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const params = parsedParams.value;
      const parsedAfterPublicId = withValidation(
        () => decodeCursor(params.cursor),
        url.pathname,
        set,
      );

      if (!parsedAfterPublicId.ok) {
        return parsedAfterPublicId.response;
      }

      const page = repository.listPatientVisits(
        parsedAfterPublicId.value,
        params.pageSize,
      );

      return {
        data: page.data.map(serializePatientVisit),
        pagination: paginationFor(url.pathname, params, page.nextPublicId),
      };
    })
    .get("/v1/patient-visits/:patient_visit_id", ({ params, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const row = repository.getPatientVisit(params.patient_visit_id);

      if (!row) {
        return problemResponse(
          404,
          "Patient visit was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializePatientVisit(row),
      };
    })
    .get(
      "/v1/patient-visits/by-number/:patient_number",
      ({ params, request, set }) => {
        const query = validateRouteQuery(request, set);

        if (!query.ok) {
          return query.response;
        }

        const visit = repository.getActivePatientVisitByNumber(
          params.patient_number,
        );

        if (!visit) {
          return problemResponse(
            404,
            "Active patient visit was not found",
            query.url.pathname,
            set,
          );
        }

        return {
          data: serializePatientVisit(visit),
        };
      },
    )
    .post("/v1/patient-movements/available-beds", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validatePatientMovementAvailableBedsInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      const result = repository.listAvailableMovementBeds({
        patientNumber: parsed.value.patient_number,
        targetDepartmentPublicId: parsed.value.target_department_id,
      });

      if (result.status === "PATIENT_VISIT_NOT_FOUND") {
        return problemResponse(
          404,
          "Active patient visit was not found",
          instance,
          set,
        );
      }

      if (result.status === "DEPARTMENT_NOT_FOUND") {
        return problemResponse(404, "Department was not found", instance, set);
      }

      return {
        data: {
          available_bed: result.value.length > 0,
          available_rooms: result.value.map((room) => ({
            id: room.room.publicId,
            name: room.room.name,
            department: room.department.name,
            station: room.station.name,
            room_type: room.room.roomType,
            bed_capacity: room.bedCapacity,
            current_capacity: room.currentCapacity,
            available_beds: room.availableBeds.map((bed) => ({
              id: bed.publicId,
              bed_type: bed.bedType,
              material: bed.material,
            })),
          })),
        },
      };
    })
    .post("/v1/patient-movements", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validatePatientMovementInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      const result = repository.movePatientToBed({
        patientNumber: parsed.value.patient_number,
        targetBedPublicId: parsed.value.target_bed_id,
      });

      if (result.status === "PATIENT_VISIT_NOT_FOUND") {
        return problemResponse(
          404,
          "Active patient visit was not found",
          instance,
          set,
        );
      }

      if (result.status === "BED_NOT_FOUND") {
        return problemResponse(404, "Bed was not found", instance, set);
      }

      if (result.status === "BED_HAS_NO_ROOM") {
        return problemResponse(
          422,
          "Target bed must be assigned to a room",
          instance,
          set,
        );
      }

      if (result.status === "BED_NOT_AVAILABLE") {
        return problemResponse(
          409,
          "Target bed is not available",
          instance,
          set,
        );
      }

      return {
        data: {
          patient_number: result.value.patientVisit.patientVisit.patientNumber,
          from_bed_id: result.value.fromBedPublicId,
          target_bed_id: result.value.targetBed.publicId,
          target_bed_status: result.value.targetBed.status,
          patient_visit: serializePatientVisit(result.value.patientVisit),
        },
      };
    })
    .post("/v1/patient-movements/completions", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validatePatientMovementCompletionInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      const result = repository.completePatientMovement({
        patientNumber: parsed.value.patient_number,
      });

      if (result.status === "PATIENT_VISIT_NOT_FOUND") {
        return problemResponse(
          404,
          "Active patient visit was not found",
          instance,
          set,
        );
      }

      if (result.status === "BED_NOT_RESERVED") {
        return problemResponse(
          409,
          "Patient movement has no reserved bed",
          instance,
          set,
        );
      }

      return {
        data: {
          patient_number: result.value.patientVisit.patientVisit.patientNumber,
          bed_id: result.value.bed.publicId,
          bed_status: result.value.bed.status,
          patient_visit: serializePatientVisit(result.value.patientVisit),
        },
      };
    })
    .post("/v1/employees", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validateEmployeeInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      try {
        const created = repository.createEmployee({
          firstName: parsed.value.first_name,
          lastName: parsed.value.last_name,
          position: parsed.value.position,
          departmentPublicId: parsed.value.department_id,
        });

        if (!created) {
          return problemResponse(404, "Department was not found", instance, set);
        }

        set.status = 201;
        set.headers.Location = `/v1/employees/${created.employee.publicId}`;

        return {
          data: serializeEmployee(created.employee, created.department),
        };
      } catch (error) {
        return handleSqlConflict(error, instance, set);
      }
    })
    .get("/v1/employees", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => parsePageParams(url),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const params = parsedParams.value;
      const parsedAfterPublicId = withValidation(
        () => decodeCursor(params.cursor),
        url.pathname,
        set,
      );

      if (!parsedAfterPublicId.ok) {
        return parsedAfterPublicId.response;
      }

      const afterPublicId = parsedAfterPublicId.value;
      const page = repository.listEmployees(afterPublicId, params.pageSize);

      return {
        data: page.data.map((row) => serializeEmployee(row.employee, row.department)),
        pagination: paginationFor(url.pathname, params, page.nextPublicId),
      };
    })
    .get("/v1/employees/:employee_id", ({ params, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const row = repository.getEmployee(params.employee_id);

      if (!row) {
        return problemResponse(
          404,
          "Employee was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializeEmployee(row.employee, row.department),
      };
    })
    .post("/v1/appointment-types", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validateAppointmentTypeInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      try {
        const created = repository.createAppointmentType({
          name: parsed.value.name,
          departmentPublicId: parsed.value.department_id,
          defaultDurationMinutes: parsed.value.default_duration_minutes,
        });

        if (!created) {
          return problemResponse(404, "Department was not found", instance, set);
        }

        set.status = 201;
        set.headers.Location = `/v1/appointment-types/${created.appointmentType.publicId}`;

        return {
          data: serializeAppointmentType(
            created.appointmentType,
            created.department,
          ),
        };
      } catch (error) {
        return handleSqlConflict(error, instance, set);
      }
    })
    .get("/v1/appointment-types", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => parsePageParams(url, ["cursor", "page_size", "department_id"]),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const params = parsedParams.value;
      const parsedAfterPublicId = withValidation(
        () => decodeCursor(params.cursor),
        url.pathname,
        set,
      );

      if (!parsedAfterPublicId.ok) {
        return parsedAfterPublicId.response;
      }

      const departmentPublicId =
        url.searchParams.get("department_id") ?? undefined;
      let departmentId: number | undefined;

      if (departmentPublicId !== undefined) {
        const department = repository.getDepartment(departmentPublicId);

        if (!department) {
          return problemResponse(
            404,
            "Department was not found",
            url.pathname,
            set,
          );
        }

        departmentId = department.id;
      }

      const afterPublicId = parsedAfterPublicId.value;
      const page = repository.listAppointmentTypes(
        afterPublicId,
        params.pageSize,
        departmentId,
      );

      return {
        data: page.data.map((row) =>
          serializeAppointmentType(row.appointmentType, row.department),
        ),
        pagination: paginationFor(
          url.pathname,
          params,
          page.nextPublicId,
          departmentPublicId ? { department_id: departmentPublicId } : undefined,
        ),
      };
    })
    .get("/v1/appointment-types/:appointment_type_id/slots", ({
      params,
      request,
      set,
    }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => validateAppointmentSlotSearchParams(url),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const appointmentType = repository.getAppointmentType(
        params.appointment_type_id,
      );

      if (!appointmentType) {
        return problemResponse(
          404,
          "Appointment type was not found",
          url.pathname,
          set,
        );
      }

      const bookedAppointments =
        repository.listBookedAppointmentsForAppointmentType(
          params.appointment_type_id,
        ) ?? [];

      return {
        data: availableSlots(
          parsedParams.value.start,
          parsedParams.value.end,
          appointmentType.appointmentType.defaultDurationMinutes,
          parsedParams.value.limit,
          new Set(
            bookedAppointments.map(
              (appointment) =>
                `${appointment.scheduledDate}T${appointment.scheduledTime}`,
            ),
          ),
        ),
      };
    })
    .get("/v1/appointment-types/:appointment_type_id", ({
      params,
      request,
      set,
    }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const row = repository.getAppointmentType(params.appointment_type_id);

      if (!row) {
        return problemResponse(
          404,
          "Appointment type was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializeAppointmentType(row.appointmentType, row.department),
      };
    })
    .post("/v1/appointments/bookings", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validateAppointmentBookingInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      try {
        const created = repository.createAppointmentBooking({
          healthInsuranceNumber: parsed.value.health_insurance_number,
          birthDate: parsed.value.birth_date,
          appointmentTypePublicId: parsed.value.appointment_type_id,
          scheduledDate: parsed.value.scheduled_date,
          scheduledTime: parsed.value.scheduled_time,
        });

        if (created.status === "PATIENT_NOT_FOUND") {
          return problemResponse(404, "Patient was not found", instance, set);
        }

        if (created.status === "APPOINTMENT_TYPE_NOT_FOUND") {
          return problemResponse(
            404,
            "Appointment type was not found",
            instance,
            set,
          );
        }

        if (created.status === "SLOT_BOOKED") {
          return problemResponse(
            409,
            "Appointment slot is already booked",
            instance,
            set,
          );
        }

        set.status = 201;
        set.headers.Location = `/v1/appointments/${created.value.appointment.publicId}`;

        return {
          data: serializeAppointment(
            created.value.appointment,
            created.value.patient,
            created.value.appointmentType,
            created.value.department,
          ),
        };
      } catch (error) {
        return handleSqlConflict(error, instance, set);
      }
    })
    .post("/v1/appointments/cancellations", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validateAppointmentCancellationInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      try {
        const canceled = repository.cancelAppointment({
          healthInsuranceNumber: parsed.value.health_insurance_number,
          birthDate: parsed.value.birth_date,
          appointmentTypePublicId: parsed.value.appointment_type_id,
          scheduledDate: parsed.value.scheduled_date,
          scheduledTime: parsed.value.scheduled_time,
        });

        if (canceled.status === "PATIENT_NOT_FOUND") {
          return problemResponse(404, "Patient was not found", instance, set);
        }

        if (canceled.status === "APPOINTMENT_TYPE_NOT_FOUND") {
          return problemResponse(
            404,
            "Appointment type was not found",
            instance,
            set,
          );
        }

        if (canceled.status === "APPOINTMENT_NOT_FOUND") {
          return problemResponse(
            404,
            "Appointment was not found",
            instance,
            set,
          );
        }

        set.status = 201;

        return {
          data: serializeAppointment(
            canceled.value.appointment,
            canceled.value.patient,
            canceled.value.appointmentType,
            canceled.value.department,
          ),
        };
      } catch (error) {
        return handleSqlConflict(error, instance, set);
      }
    })
    .post("/v1/appointments/reschedules", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validateAppointmentRescheduleInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      try {
        const rescheduled = repository.rescheduleAppointment({
          healthInsuranceNumber: parsed.value.health_insurance_number,
          birthDate: parsed.value.birth_date,
          appointmentTypePublicId: parsed.value.appointment_type_id,
          fromScheduledDate: parsed.value.from_scheduled_date,
          fromScheduledTime: parsed.value.from_scheduled_time,
          toScheduledDate: parsed.value.to_scheduled_date,
          toScheduledTime: parsed.value.to_scheduled_time,
        });

        if (rescheduled.status === "PATIENT_NOT_FOUND") {
          return problemResponse(404, "Patient was not found", instance, set);
        }

        if (rescheduled.status === "APPOINTMENT_TYPE_NOT_FOUND") {
          return problemResponse(
            404,
            "Appointment type was not found",
            instance,
            set,
          );
        }

        if (rescheduled.status === "APPOINTMENT_NOT_FOUND") {
          return problemResponse(
            404,
            "Appointment was not found",
            instance,
            set,
          );
        }

        if (rescheduled.status === "SLOT_BOOKED") {
          return problemResponse(
            409,
            "Appointment slot is already booked",
            instance,
            set,
          );
        }

        set.status = 201;
        set.headers.Location = `/v1/appointments/${rescheduled.value.appointment.publicId}`;

        return {
          data: serializeAppointment(
            rescheduled.value.appointment,
            rescheduled.value.patient,
            rescheduled.value.appointmentType,
            rescheduled.value.department,
          ),
        };
      } catch (error) {
        return handleSqlConflict(error, instance, set);
      }
    })
    .post("/v1/appointments/searches", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validatePatientAppointmentSearchInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      const result = repository.listPatientAppointmentSummaries(
        parsed.value.health_insurance_number,
        parsed.value.birth_date,
      );

      if (result.status === "PATIENT_NOT_FOUND") {
        return problemResponse(404, "Patient was not found", instance, set);
      }

      return {
        data: result.data.map(serializePatientAppointmentSummary),
      };
    })
    .post("/v1/appointments", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validateAppointmentInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      try {
        const created = repository.createAppointment({
          scheduledDate: parsed.value.scheduled_date,
          scheduledTime: parsed.value.scheduled_time,
          patientPublicId: parsed.value.linked_patient_id,
          appointmentTypePublicId: parsed.value.appointment_type_id,
        });

        if (created.status === "PATIENT_NOT_FOUND") {
          return problemResponse(404, "Patient was not found", instance, set);
        }

        if (created.status === "APPOINTMENT_TYPE_NOT_FOUND") {
          return problemResponse(
            404,
            "Appointment type was not found",
            instance,
            set,
          );
        }

        set.status = 201;
        set.headers.Location = `/v1/appointments/${created.value.appointment.publicId}`;

        return {
          data: serializeAppointment(
            created.value.appointment,
            created.value.patient,
            created.value.appointmentType,
            created.value.department,
          ),
        };
      } catch (error) {
        return handleSqlConflict(error, instance, set);
      }
    })
    .get("/v1/appointments", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => parsePageParams(url, ["cursor", "page_size", "date"]),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const params = parsedParams.value;
      const parsedAfterPublicId = withValidation(
        () => decodeCursor(params.cursor),
        url.pathname,
        set,
      );

      if (!parsedAfterPublicId.ok) {
        return parsedAfterPublicId.response;
      }

      const parsedDate = withValidation(
        () => validateAppointmentListQuery(url),
        url.pathname,
        set,
      );

      if (!parsedDate.ok) {
        return parsedDate.response;
      }

      const date = parsedDate.value;
      const afterPublicId = parsedAfterPublicId.value;
      const page = repository.listAppointments(
        afterPublicId,
        params.pageSize,
        date,
      );

      return {
        data: page.data.map((row) =>
          serializeAppointment(
            row.appointment,
            row.patient,
            row.appointmentType,
            row.department,
          ),
        ),
        pagination: paginationFor(
          url.pathname,
          params,
          page.nextPublicId,
          date ? { date } : undefined,
        ),
      };
    })
    .get("/v1/appointments/:appointment_id", ({ params, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const row = repository.getAppointment(params.appointment_id);

      if (!row) {
        return problemResponse(
          404,
          "Appointment was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializeAppointment(
          row.appointment,
          row.patient,
          row.appointmentType,
          row.department,
        ),
      };
    })
    .post("/v1/patients", ({ body, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const instance = query.url.pathname;
      const parsed = withValidation(
        () => validatePatientInput(body),
        instance,
        set,
      );

      if (!parsed.ok) {
        return parsed.response;
      }

      const input = parsed.value;

      try {
        const created = repository.createPatient({
          gender: input.gender,
          firstName: input.first_name,
          lastName: input.last_name,
          birthDate: input.birth_date,
          birthplace: input.birthplace,
          socialSecurityNumberPublicId: input.social_security_number_id,
          telephoneNumber: input.telephone_number,
          acceptedGdpr: input.accepted_gdpr,
        });

        if (!created) {
          return problemResponse(
            404,
            "Social security number was not found",
            instance,
            set,
          );
        }

        set.status = 201;
        set.headers.Location = `/v1/patients/${created.patient.publicId}`;

        return {
          data: serializePatient(created.patient, created.socialSecurityNumber),
        };
      } catch (error) {
        return handleSqlConflict(error, instance, set);
      }
    })
    .get("/v1/patients", ({ request, set }) => {
      const url = new URL(request.url);
      const parsedParams = withValidation(
        () => parsePageParams(url),
        url.pathname,
        set,
      );

      if (!parsedParams.ok) {
        return parsedParams.response;
      }

      const params = parsedParams.value;
      const parsedAfterPublicId = withValidation(
        () => decodeCursor(params.cursor),
        url.pathname,
        set,
      );

      if (!parsedAfterPublicId.ok) {
        return parsedAfterPublicId.response;
      }

      const afterPublicId = parsedAfterPublicId.value;
      const page = repository.listPatients(afterPublicId, params.pageSize);

      return {
        data: page.data.map((row) =>
          serializePatient(row.patient, row.socialSecurityNumber),
        ),
        pagination: paginationFor(url.pathname, params, page.nextPublicId),
      };
    })
    .get("/v1/patients/search", ({ request, set }) => {
      const query = validateRouteQuery(request, set, ["q", "limit"]);

      if (!query.ok) {
        return query.response;
      }

      const q = query.url.searchParams.get("q") ?? "";
      const rawLimit = query.url.searchParams.get("limit");
      const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 10;
      const limit = Number.isFinite(parsedLimit)
        ? Math.min(25, Math.max(1, parsedLimit))
        : 10;

      return {
        data: repository
          .searchPatients(q, limit)
          .map(serializePatientSearchResult),
      };
    })
    .get("/v1/patients/:patient_id", ({ params, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const row = repository.getPatient(params.patient_id);

      if (!row) {
        return problemResponse(
          404,
          "Patient was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializePatient(row.patient, row.socialSecurityNumber),
      };
    })
    .get("/v1/patients/:patient_id/overview", ({ params, request, set }) => {
      const query = validateRouteQuery(request, set);

      if (!query.ok) {
        return query.response;
      }

      const overview = repository.patientOverview(params.patient_id);

      if (!overview) {
        return problemResponse(
          404,
          "Patient was not found",
          query.url.pathname,
          set,
        );
      }

      return {
        data: serializePatientOverview(overview),
      };
    })
    // Catch-all: anything not matched by a `/v1` route above. Unmatched API
    // paths still get a Problem-Details 404; everything else is served from the
    // built frontend (SPA), so one server hosts the UI at `/` and the API at
    // `/v1`. Registered last; Elysia matches specific routes first.
    .get("/", ({ request, set }) =>
      serveFrontendOrProblem(options.frontendDir, request, set),
    )
    .get("/*", ({ request, set }) =>
      serveFrontendOrProblem(options.frontendDir, request, set),
    );
}

/**
 * Serve the SPA for a non-API request, or a Problem-Details 404 for an
 * unmatched `/v1` path (or when no frontend build is present).
 */
function serveFrontendOrProblem(
  frontendDir: string | null | undefined,
  request: Request,
  set: ResponseSet,
) {
  const { pathname } = new URL(request.url);

  if (!frontendDir || pathname === "/v1" || pathname.startsWith("/v1/")) {
    return problemResponse(404, "Endpoint was not found", pathname, set);
  }

  return respondWithStatic(frontendDir, pathname, set);
}

function availableSlots(
  start: string,
  end: string,
  durationMinutes: number,
  limit: number,
  bookedDateTimes: Set<string>,
) {
  const slots: Array<{ scheduled_date: string; scheduled_time: string }> = [];
  let current = parseBerlinLocalDateTime(start);
  const endDateTime = parseBerlinLocalDateTime(end);

  while (
    compareLocalDateTime(current, endDateTime) < 0 &&
    slots.length < limit
  ) {
    const key = formatBerlinLocalDateTime(current);

    if (!bookedDateTimes.has(key)) {
      slots.push({
        scheduled_date: key.slice(0, 10),
        scheduled_time: key.slice(11),
      });
    }

    current = addMinutes(current, durationMinutes);
  }

  return slots;
}

function parseBerlinLocalDateTime(value: string) {
  const [date, time] = value.split("T") as [string, string];
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [hour, minute] = time.split(":").map(Number) as [number, number];

  return {
    year,
    month,
    day,
    hour,
    minute,
  };
}

function addMinutes(
  dateTime: ReturnType<typeof parseBerlinLocalDateTime>,
  minutes: number,
) {
  const utc = Date.UTC(
    dateTime.year,
    dateTime.month - 1,
    dateTime.day,
    dateTime.hour,
    dateTime.minute + minutes,
  );
  const next = new Date(utc);

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: next.getUTCHours(),
    minute: next.getUTCMinutes(),
  };
}

function compareLocalDateTime(
  left: ReturnType<typeof parseBerlinLocalDateTime>,
  right: ReturnType<typeof parseBerlinLocalDateTime>,
) {
  return formatBerlinLocalDateTime(left).localeCompare(
    formatBerlinLocalDateTime(right),
  );
}

function formatBerlinLocalDateTime(
  dateTime: ReturnType<typeof parseBerlinLocalDateTime>,
) {
  return `${pad(dateTime.year, 4)}-${pad(dateTime.month)}-${pad(
    dateTime.day,
  )}T${pad(dateTime.hour)}:${pad(dateTime.minute)}`;
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

type DepartmentLike = {
  id: number;
  name: string;
  currentCapacity: number;
  maxCapacity: number;
};

type PatientWithInsuranceLike = {
  socialSecurityNumber: {
    healthInsuranceProvider: string;
    insuranceType: "STATUTORY" | "PRIVATE";
  };
};

type GeneratedInvoice = {
  id: string;
  department: string;
  payer: string;
  insurance_type: "STATUTORY" | "PRIVATE";
  amount: number;
  status: "PAID" | "OPEN" | "OVERDUE";
  issued_date: string;
};

const financialEndDate = "2026-07-10";
const invoiceStatuses = ["PAID", "PAID", "OPEN", "OVERDUE"] as const;
const alertTemplates = [
  {
    severity: "CRITICAL",
    category: "CAPACITY",
    message: "ICU occupancy above 95%",
  },
  {
    severity: "WARNING",
    category: "CAPACITY",
    message: "Department nearing max capacity",
  },
  {
    severity: "WARNING",
    category: "STAFFING",
    message: "Night shift understaffed",
  },
  {
    severity: "INFO",
    category: "LOGISTICS",
    message: "Bed cleaning completed",
  },
  {
    severity: "CRITICAL",
    category: "EMERGENCY",
    message: "Incoming trauma - Schockraum on standby",
  },
  {
    severity: "INFO",
    category: "APPOINTMENTS",
    message: "Peak outpatient volume in the next hour",
  },
] as const;

function financialsByDepartment(departments: DepartmentLike[]) {
  return departments.map((department, index) => {
    const revenue =
      40_000 +
      department.maxCapacity * 3_500 +
      department.currentCapacity * 1_200 +
      index * 7_500;

    return {
      department: department.name,
      revenue,
      cost: Math.round(revenue * (0.56 + (index % 5) * 0.035)),
    };
  });
}

// Builds a deterministic, BOUNDED synthetic invoice sample from the passed
// departments + patients (a demo dataset for the dashboard, not persisted).
// It is intentionally sample-based and is NOT used for payer_mix or any total
// that must reflect all patients — those are computed via SQL aggregates.
function financialInvoices(
  departments: DepartmentLike[],
  patients: PatientWithInsuranceLike[],
): GeneratedInvoice[] {
  if (departments.length === 0 || patients.length === 0) {
    return [];
  }

  return Array.from({ length: 48 }, (_, index) => {
    const patient = patients[index % patients.length];
    const department = departments[index % departments.length];

    return {
      id: `inv_${String(index + 1).padStart(5, "0")}`,
      department: department.name,
      payer: patient.socialSecurityNumber.healthInsuranceProvider,
      insurance_type: patient.socialSecurityNumber.insuranceType,
      amount: 400 + ((index * 1_731) % 9_600),
      status: invoiceStatuses[index % invoiceStatuses.length],
      issued_date: isoMinus(financialEndDate, (index * 7) % 45),
    };
  });
}

function revenueTrend(days: number, departments: DepartmentLike[]) {
  const baseRevenue = Math.max(
    150_000,
    Math.round(sumBy(financialsByDepartment(departments), (row) => row.revenue) / 8),
  );

  return Array.from({ length: days }, (_, index) => {
    const daysBack = days - index - 1;
    const revenue = baseRevenue + ((index * 23_000 + days * 1_700) % 140_000);

    return {
      date: isoMinus(financialEndDate, daysBack),
      revenue,
      cost: Math.round(revenue * (0.58 + (index % 4) * 0.04)),
    };
  });
}

function operationalAlerts(departments: DepartmentLike[]) {
  const fallbackDepartment = "Uniklikum X";

  return alertTemplates.map((template, index) => ({
    id: `alt_${index + 1}`,
    severity: template.severity,
    category: template.category,
    message: template.message,
    department:
      departments[(index * 3 + 1) % Math.max(departments.length, 1)]?.name ??
      fallbackDepartment,
    created_at: `2026-07-10T09:${String(index).padStart(2, "0")}:00.000+02:00`,
  }));
}

function staffingByDepartment(
  departments: DepartmentLike[],
  employeeCountsByDepartmentId: Map<number, number>,
) {
  return departments.map((department, index) => {
    // Real, SQL-aggregated per-department employee count over ALL employees
    // (see `countEmployeesByDepartment`) — totals across departments always
    // sum to the true total employee count (e.g. 1,000), never a capped
    // 100-row sample.
    const total = employeeCountsByDepartmentId.get(department.id) ?? 0;
    const onCall = total > 0 ? index % 4 : 0;
    const onShift =
      total > 0
        ? Math.max(1, Math.min(total - onCall, Math.ceil(total * 0.65)))
        : 0;

    return {
      department: department.name,
      on_shift: onShift,
      on_call: onCall,
      total,
    };
  });
}

const opsSummaryDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function parseOpsSummaryDate(url: URL): string | undefined {
  validateQueryParams(url, ["date"]);

  const date = url.searchParams.get("date") ?? undefined;

  if (date !== undefined && !opsSummaryDatePattern.test(date)) {
    throw new Error("date must use YYYY-MM-DD format");
  }

  return date;
}

function parseFloorDetailQuery(url: URL): { building: string; level: number } {
  validateQueryParams(url, ["building", "level"]);

  const building = url.searchParams.get("building");

  if (!building || building.trim().length === 0) {
    throw new Error("building must be provided");
  }

  const rawLevel = url.searchParams.get("level");

  if (rawLevel === null || rawLevel.trim().length === 0) {
    throw new Error("level must be provided");
  }

  const level = Number(rawLevel);

  if (!Number.isInteger(level) || level < 0) {
    throw new Error("level must be a non-negative integer");
  }

  return { building, level };
}

function parseTrendDays(url: URL) {
  const rawDays = url.searchParams.get("days");
  const days = rawDays ? Number(rawDays) : 30;

  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error("days must be an integer between 1 and 365");
  }

  return days;
}

function isoMinus(endDate: string, daysBack: number) {
  const [year, month, day] = endDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day - daysBack));

  return date.toISOString().slice(0, 10);
}

function marginPct(revenue: number, cost: number) {
  if (revenue === 0) {
    return 0;
  }

  return Math.round(((revenue - cost) / revenue) * 1_000) / 10;
}

function sumBy<T>(rows: T[], getValue: (row: T) => number) {
  return rows.reduce((sum, row) => sum + getValue(row), 0);
}

function pageGeneratedRows<T>(
  rows: T[],
  pageSize: number,
  getPublicId: (row: T) => string,
) {
  const data = rows.slice(0, pageSize);
  const extra = rows.at(pageSize);
  const last = data.at(-1);

  return {
    data,
    nextPublicId: extra && last ? getPublicId(last) : undefined,
  };
}

function serializeSeedSummary(summary: ReturnType<typeof resetAndSeedDatabase>) {
  return {
    social_security_numbers: summary.socialSecurityNumbers,
    patients: summary.patients,
    departments: summary.departments,
    stations: summary.stations,
    rooms: summary.rooms,
    beds: summary.beds,
    patient_visits: summary.patientVisits,
    employees: summary.employees,
    appointment_types: summary.appointmentTypes,
    appointments: summary.appointments,
  };
}

function validateRouteQuery(
  request: Request,
  set: ResponseSet,
  allowedFields: readonly string[] = [],
):
  | { ok: true; url: URL }
  | { ok: false; response: ReturnType<typeof problem> } {
  const url = new URL(request.url);
  const parsed = withValidation(
    () => validateQueryParams(url, allowedFields),
    url.pathname,
    set,
  );

  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    url,
  };
}

function withValidation<T>(
  fn: () => T,
  instance: string,
  set: ResponseSet,
):
  | { ok: true; value: T }
  | { ok: false; response: ReturnType<typeof problem> } {
  try {
    return {
      ok: true,
      value: fn(),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid input";
    return {
      ok: false,
      response: problemResponse(422, detail, instance, set),
    };
  }
}

function handleSqlConflict(
  error: unknown,
  instance: string,
  set: ResponseSet,
) {
  if (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed")
  ) {
    return problemResponse(409, "Resource already exists", instance, set);
  }

  throw error;
}

function problemResponse(
  status: ProblemStatus,
  detail: string,
  instance: string,
  set: ResponseSet,
) {
  set.status = status;
  set.headers["Content-Type"] = "application/problem+json";

  return problem(status, detail, instance);
}
