import { ApplicationError } from "../../domain/errors/application-error.js";

const ITERATIONS = 310000;
const encoder = new TextEncoder();
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2,"0")).join("");
const randomText = (n) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n))))
  .replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
async function digest(value) { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2",salt:encoder.encode(salt),iterations:ITERATIONS,hash:"SHA-256"},key,256);
  return hex(bits);
}
function same(a,b) {
  if (typeof a!=="string" || typeof b!=="string" || a.length!==b.length) return false;
  let diff=0; for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i); return diff===0;
}

export class AccessService {
  constructor(repository) { this.repo=repository; }
  async issue(user, label="api") {
    const secret=`cm_${randomText(32)}`;
    const scopes=user.role==="admin"?["read","admin"]:["read"];
    const now=Date.now(),expiresAt=now+30*24*60*60*1000;
    await this.repo.saveToken(user.id,label,await digest(secret),scopes,now);
    return {token:secret,token_type:"Bearer",scopes,expires_at_ms:expiresAt};
  }
  async bootstrap({username,password,setupKey}, expectedKey) {
    if (!expectedKey || !same(setupKey,expectedKey)) throw new ApplicationError("invalid_setup_key",403);
    if (await this.repo.hasAdmin()) throw new ApplicationError("admin_already_initialized",409);
    this.validateCredentials(username,password);
    const salt=randomText(24), hash=await passwordHash(password,salt), now=Date.now();
    await this.repo.createUser({username,passwordHash:hash,salt,role:"admin",now});
    const user=await this.repo.user(username);
    return this.issue(user,"initial-admin");
  }
  async login({username,password}) {
    const user=await this.repo.user(username||"");
    if (!user || !same(await passwordHash(password||"",user.password_salt),user.password_hash))
      throw new ApplicationError("invalid_credentials",401);
    return this.issue(user,"login");
  }
  async authenticate(request) {
    const value=request.headers.get("authorization")||"";
    const match=value.match(/^Bearer\s+(cm_[A-Za-z0-9_-]{32,})$/);
    if (!match) return null;
    const token=await this.repo.token(await digest(match[1]));
    if (!token || (token.expires_at_ms && token.expires_at_ms<=Date.now())) return null;
    await this.repo.touchToken(token.token_id,Date.now());
    return {id:token.user_id,username:token.username,role:token.role,scopes:JSON.parse(token.scopes_json)};
  }
  async createAccount({username,password,role="reader"}) {
    if (!['reader','admin'].includes(role)) throw new ApplicationError("invalid_role",400);
    this.validateCredentials(username,password);
    const salt=randomText(24), hash=await passwordHash(password,salt);
    await this.repo.createUser({username,passwordHash:hash,salt,role,now:Date.now()});
    return this.issue(await this.repo.user(username),role);
  }
  validateCredentials(username,password) {
    if (!/^[A-Za-z0-9_.-]{3,64}$/.test(username||"") || typeof password!=="string" || password.length<12 || password.length>256)
      throw new ApplicationError("invalid_credentials_format",400,"Username must be 3-64 chars and password 12-256 chars");
  }
}
