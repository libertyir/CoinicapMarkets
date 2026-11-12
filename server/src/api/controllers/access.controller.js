import { json } from "./http.js";

async function body(request) {
  try { return await request.json(); } catch { return {}; }
}
export async function bootstrapAdmin(request, app, env) {
  try { return json(await app.access.bootstrap(await body(request),env.ADMIN_SETUP_KEY),201); }
  catch(e) { return json({error:e.code||"internal_error",message:e.message},e.status||500); }
}
export async function login(request, app) {
  try { return json(await app.access.login(await body(request))); }
  catch(e) { return json({error:e.code||"internal_error",message:e.message},e.status||500); }
}
export async function listPolicies(app) { return json(await app.accessRepository.policies()); }
export async function updatePolicy(request, app, routeKey, user) {
  const input=await body(request);
  if (typeof input.is_public!=="boolean" || (input.enabled!==undefined && typeof input.enabled!=="boolean"))
    return json({error:"invalid_policy",message:"is_public and enabled must be boolean"},400);
  await app.accessRepository.setPolicy(routeKey,input.is_public,input.enabled!==false,user.id,Date.now());
  return json({route_key:routeKey,is_public:input.is_public,enabled:input.enabled!==false});
}
export async function createAccount(request, app) {
  try { return json(await app.access.createAccount(await body(request)),201); }
  catch(e) { return json({error:e.code||"internal_error",message:e.message},e.status||500); }
}
export async function listUsers(app) { return json(await app.accessRepository.listUsers()); }
export async function listTokens(app) { return json(await app.accessRepository.listTokens()); }
export async function revokeToken(app, id) {
  await app.accessRepository.revokeToken(Number(id),Date.now());
  return json({revoked:true});
}
