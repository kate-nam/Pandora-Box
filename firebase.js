import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { config } from 'dotenv';

// Load environment variables from .env
config();

const firebaseConfig = {
    apiKey: "AIzaSyD4SFVPQ1pb1VhL8xIWKhcwKZQk1-e1BsI",
    authDomain: "ai-proto-project1.firebaseapp.com",
    databaseURL: "https://ai-proto-project1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ai-proto-project1",
    storageBucket: "ai-proto-project1.appspot.com",
    messagingSenderId: "419557176057",
    appId: "1:419557176057:web:7f6e851059d05ab4a5e828",
    measurementId: "G-VPWR6K6N0Z"
  };
  


// Initialize Firebase App
const firebaseApp = initializeApp(firebaseConfig);

// Get a reference to the Realtime Database service
const db = getDatabase(firebaseApp);

export default db;
