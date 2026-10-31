import "server-only";

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

/**
 * 500 for unexpected (database) failures: the raw message goes to the server log only (Workers observability),
 * the client gets a fixed text so table/column names and driver messages never leave the server.
 */
export function serverError(where: string, cause: unknown) {
  const detail = cause && typeof cause === "object" && "message" in cause ? (cause as { message: unknown }).message : cause;
  console.error(`[api] ${where}:`, detail);
  return jsonError(500, "server error");
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
