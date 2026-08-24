export async function completeGuestScanAfterSuccessfulInference<T>(runInference: () => Promise<T>, recordSuccessfulCompletion: () => Promise<unknown>) {
  const result = await runInference();
  await recordSuccessfulCompletion();
  return result;
}
