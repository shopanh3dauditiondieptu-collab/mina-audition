import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getFirestore,
  initializeFirestore
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  MINA_CONFIG
} from "./config.js?v=14.1.0";

const MINA_APP_NAME = "mina-v14-app";

const existingApp = getApps().find(
  app => app.name === MINA_APP_NAME
);

export const app =
  existingApp ||
  initializeApp(
    MINA_CONFIG.firebase,
    MINA_APP_NAME
  );

let firestoreDb;

try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true
  });
} catch (error) {
  // Firestore đã được khởi tạo trước đó cho app này.
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;

console.info(
  "[Mina V14 Firebase] Đã kết nối project:",
  app.options.projectId,
  "| App:",
  app.name
);
