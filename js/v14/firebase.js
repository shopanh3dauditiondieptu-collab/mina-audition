import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { MINA_CONFIG } from "./config.js";

const app = getApps().length ? getApps()[0] : initializeApp(MINA_CONFIG.firebase);
export const db = getFirestore(app);
