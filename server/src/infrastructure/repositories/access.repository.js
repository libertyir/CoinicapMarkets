export class AccessRepository {
  constructor(db) { this.db = db; }
  async hasAdmin() {
    return Boolean(await this.db.prepare("SELECT 1 AS ok FROM users WHERE role='admin' LIMIT 1").first());
  }
  createUser({ username, passwordHash, salt, role, now }) {
    return this.db.prepare(`INSERT INTO users
      (username,password_hash,password_salt,password_iterations,role,created_at_ms,updated_at_ms)
      VALUES (?,?,?,310000,?,?,?)`).bind(username,passwordHash,salt,role,now,now).run();
  }
  async user(username) {
    return this.db.prepare("SELECT * FROM users WHERE username=? AND enabled=1").bind(username).first();
  }
  async token(hash) {
    return this.db.prepare(`SELECT t.id AS token_id,t.user_id,t.scopes_json,t.expires_at_ms,
      u.username,u.role FROM api_tokens t JOIN users u ON u.id=t.user_id
      WHERE t.token_hash=? AND t.enabled=1 AND t.revoked_at_ms IS NULL AND u.enabled=1`)
      .bind(hash).first();
  }
  async saveToken(userId, label, hash, scopes, now) {
    await this.db.prepare(`INSERT INTO api_tokens
      (user_id,label,token_hash,scopes_json,created_at_ms,expires_at_ms) VALUES (?,?,?,?,?,?)`)
      .bind(userId,label,hash,JSON.stringify(scopes),now,now+30*24*60*60*1000).run();
  }
  async touchToken(id, now) {
    await this.db.prepare("UPDATE api_tokens SET last_used_at_ms=? WHERE id=?").bind(now,id).run();
  }
  async revokeToken(id, now) {
    return this.db.prepare("UPDATE api_tokens SET enabled=0,revoked_at_ms=? WHERE id=? AND revoked_at_ms IS NULL")
      .bind(now,id).run();
  }
  async policies() { return (await this.db.prepare("SELECT route_key,is_public,enabled,updated_at_ms FROM api_access_policies ORDER BY route_key").all()).results; }
  async policy(key) { return this.db.prepare("SELECT is_public,enabled FROM api_access_policies WHERE route_key=?").bind(key).first(); }
  async setPolicy(key, isPublic, enabled, userId, now) {
    return this.db.prepare(`INSERT INTO api_access_policies(route_key,is_public,enabled,updated_at_ms,updated_by)
      VALUES(?,?,?,?,?) ON CONFLICT(route_key) DO UPDATE SET is_public=excluded.is_public,
      enabled=excluded.enabled,updated_at_ms=excluded.updated_at_ms,updated_by=excluded.updated_by`)
      .bind(key,isPublic?1:0,enabled?1:0,now,userId).run();
  }
  async listUsers() {
    return (await this.db.prepare(`SELECT id,username,role,enabled,created_at_ms,updated_at_ms
      FROM users ORDER BY id`).all()).results;
  }
  async listTokens() {
    return (await this.db.prepare(`SELECT t.id,t.user_id,u.username,t.label,t.scopes_json,
      t.enabled,t.created_at_ms,t.expires_at_ms,t.last_used_at_ms,t.revoked_at_ms
      FROM api_tokens t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC`).all()).results;
  }
}
