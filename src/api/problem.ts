export type ProblemStatus = 400 | 404 | 409 | 422 | 500;

const problemTitles: Record<ProblemStatus, string> = {
  400: "Bad Request",
  404: "Not Found",
  409: "Conflict",
  422: "Invalid Input",
  500: "Internal Server Error",
};

const problemTypes: Record<ProblemStatus, string> = {
  400: "bad-request",
  404: "not-found",
  409: "conflict",
  422: "invalid-input",
  500: "internal-server-error",
};

export function problem(status: ProblemStatus, detail: string, instance: string) {
  return {
    type: `https://api.fertig.ai/problems/${problemTypes[status]}`,
    title: problemTitles[status],
    status,
    detail,
    instance,
  };
}
