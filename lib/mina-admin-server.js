const crypto = require("crypto");
const admin = require("firebase-admin");

function cleanEnv(value) {
  if (value === undefined || value === null) return "";
  let result = String(value).trim();
  if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith("'") && result.endsWith("'"))) result = result.slice(1,-1).trim();
  return result;
}
function firstEnv(names) { for (const name of names) { const value=cleanEnv(process.env[name]); if (value) return value; } return ""; }
function safeEqual(a,b) { const l=Buffer.from(String(a||""),"utf8"), r=Buffer.from(String(b||""),"utf8"); return l.length===r.length && crypto.timingSafeEqual(l,r); }
function parseServiceAccount() {
  const raw=cleanEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); if(!raw) throw new Error("Thiếu FIREBASE_SERVICE_ACCOUNT_JSON.");
  let account; try { account=JSON.parse(raw); } catch { account=JSON.parse(Buffer.from(raw,"base64").toString("utf8")); }
  if(!account.project_id||!account.client_email||!account.private_key) throw new Error("Service Account thiếu dữ liệu bắt buộc.");
  account.private_key=String(account.private_key).replace(/\\n/g,"\n"); return account;
}
function getAdminApp() { if(admin.apps.length) return admin.app(); const a=parseServiceAccount(); return admin.initializeApp({credential:admin.credential.cert(a),projectId:a.project_id}); }
function getFirestore() { return admin.firestore(getAdminApp()); }
function bearerToken(req) { return String(req.headers.authorization||"").match(/^Bearer\s+(.+)$/i)?.[1]||""; }
async function requireAdmin(req,res) {
  const token=bearerToken(req);
  if(token) {
    try { const decoded=await admin.auth(getAdminApp()).verifyIdToken(token); if(decoded?.uid) return decoded; } catch(error) { console.warn("Invalid Firebase token:", error.message); }
  }
  const expected=firstEnv(["MINA_ADMIN_API_KEY","MINA_ADMIN_KEY","MINA_API_KEY","ADMIN_API_KEY","ADMIN_KEY"]);
  const received=cleanEnv(req.headers["x-mina-admin-key"]||"");
  if(expected && received && safeEqual(expected,received)) return {apiKey:true};
  res.status(401).json({success:false,code:"UNAUTHORIZED",message:"Phiên quản trị không hợp lệ hoặc đã hết hạn."}); return null;
}
function setJsonHeaders(res) { res.setHeader("Cache-Control","no-store, max-age=0"); res.setHeader("Content-Type","application/json; charset=utf-8"); }
module.exports={admin,getFirestore,requireAdmin,setJsonHeaders};
