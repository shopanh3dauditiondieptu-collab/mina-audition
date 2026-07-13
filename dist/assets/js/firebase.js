import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
const firebaseConfig={apiKey:'AIzaSyD0bWkR6Dhdrg94JkTw5nWjH6LoydjR080',authDomain:'minaaudition-13650.firebaseapp.com',projectId:'minaaudition-13650',storageBucket:'minaaudition-13650.firebasestorage.app',messagingSenderId:'411681077748',appId:'1:411681077748:web:ba18c9ee93527f5b7321a1'};
const app=initializeApp(firebaseConfig);export const auth=getAuth(app);export const db=getFirestore(app);
