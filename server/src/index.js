import { route } from "./api/router.js";
import { collectScheduled } from "./collector/index.js";

export default {
  fetch(request, env) {
    return route(request, env);
  },
  scheduled(_event, env, ctx) {
    ctx.waitUntil(collectScheduled(env));
  },
};
