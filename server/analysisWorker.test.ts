import { describe, expect, it } from "vitest";
import { classifyAnalysisWorkerFailure } from "./analysisWorker";

describe("durable MRI worker failure classification", () => {
  it("keeps persistent-upload and database-finalization failures distinct and retryable", () => {
    expect(classifyAnalysisWorkerFailure(new Error("PERSISTENT_UPLOAD_FAILED"))).toMatchObject({ code: "PERSISTENT_UPLOAD_FAILED", message: expect.stringContaining("could not be uploaded") });
    expect(classifyAnalysisWorkerFailure(new Error("DATABASE_FINALIZATION_FAILED"))).toMatchObject({ code: "DATABASE_FINALIZATION_FAILED", message: expect.stringContaining("without rerunning inference") });
  });
});
