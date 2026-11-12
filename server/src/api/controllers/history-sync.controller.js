import { json } from "./http.js";

export async function importHistoryJson(request, app) {
  try { return json(await app.historySync.importJson(await request.json())); }
  catch(error) {
    return json({error:error.code||"invalid_history_import",message:error.message},error.status||400);
  }
}
