import { api } from "@/lib/server/api";
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  return api(request, (await context.params).path);
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
