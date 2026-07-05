import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listActiveJobsTool from "./tools/list-active-jobs";
import getJobTool from "./tools/get-job";
import listMyResponsesTool from "./tools/list-my-responses";
import getMyProfileTool from "./tools/get-my-profile";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gruzli-mcp",
  title: "Gruzli",
  version: "0.1.0",
  instructions:
    "Tools for Gruzli, a platform connecting movers (грузчики) with dispatchers. " +
    "Use `list_active_jobs` to browse the feed of active loader jobs, `get_job` to fetch a single job's details, " +
    "`list_my_responses` to see the signed-in user's applications, and `get_my_profile` to read their profile.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listActiveJobsTool, getJobTool, listMyResponsesTool, getMyProfileTool],
});
