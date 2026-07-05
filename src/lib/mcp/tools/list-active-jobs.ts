import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_active_jobs",
  title: "List active jobs",
  description: "List currently active loader jobs (заявки) from the Gruzli feed.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Max number of jobs to return."),
    metro: z.string().optional().describe("Optional metro station filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, metro }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("jobs")
      .select("id,title,address,metro,hourly_rate,duration_hours,workers_needed,start_time,urgent,status")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (metro) query = query.ilike("metro", `%${metro}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { jobs: data ?? [] },
    };
  },
});
