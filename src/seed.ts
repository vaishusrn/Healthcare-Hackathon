import { createDatabase } from "./db/client";
import { migrate } from "./db/migrate";
import { seedDatabase, seedHospitalName } from "./db/seed";

const dbFileName = process.env.DB_FILE_NAME ?? "healthcare.sqlite";
const db = createDatabase(dbFileName);

migrate(db);
const summary = seedDatabase(db);
db.$client.close();

console.log(`Seeded German mock data for ${seedHospitalName} into ${dbFileName}`);
console.log(`- social_security_numbers: ${summary.socialSecurityNumbers}`);
console.log(`- patients: ${summary.patients}`);
console.log(`- departments: ${summary.departments}`);
console.log(`- stations: ${summary.stations}`);
console.log(`- rooms: ${summary.rooms}`);
console.log(`- beds: ${summary.beds}`);
console.log(`- patient_visits: ${summary.patientVisits}`);
console.log(`- employees: ${summary.employees}`);
console.log(`- appointment_types: ${summary.appointmentTypes}`);
console.log(`- appointments: ${summary.appointments}`);
