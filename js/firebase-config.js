import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyD0bWkR6Dhdrg94JkTw5nWjH6LoydjR080",
  authDomain: "minaaudition-13650.firebaseapp.com",
  projectId: "minaaudition-13650",
  storageBucket: "minaaudition-13650.firebasestorage.app",
  messagingSenderId: "411681077748",
  appId: "1:411681077748:web:ba18c9ee93527f5b7321a1",
  measurementId: "G-3NY5WVRYHN"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app };
