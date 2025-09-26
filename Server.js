// Use ES Module imports for consistency
import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import cors from "cors";
import { readFileSync } from 'fs';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import Razorpay from 'razorpay';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// --- 1. FIREBASE ADMIN SETUP ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccount = JSON.parse(readFileSync(path.resolve(__dirname, 'serviceAccountKey.json'), 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});
const db = admin.firestore();
const productsCollection = db.collection('products');


// --- 2. CLOUDINARY CONFIGURATION ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'hyjain-products', allowed_formats: ['jpeg', 'png', 'jpg', 'webp'] }
});
const upload = multer({ storage: storage });


// --- 3. RAZORPAY INITIALIZATION (OPTIONAL) ---
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log("Razorpay initialized successfully.");
} else {
    console.log("WARNING: Razorpay keys not found. Payment routes will be disabled.");
}


// --- 4. EXPRESS APP SETUP ---
const app = express();

// ✅ START OF CORS FIX
// Define the specific URL of your deployed frontend.
// Replace 'https://ecomfrontend.onrender.com' with your actual frontend URL if it's different.
const allowedOrigins = ['https://ecomfrontend.onrender.com'];

// You can add your local development URL here for testing
// const allowedOrigins = ['https://ecomfrontend.onrender.com', 'http://localhost:5173'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
};

// Use the configured CORS options
app.use(cors(corsOptions));
// ✅ END OF CORS FIX

app.use(express.json());


// ========================================================
// --- 5. ALL API ROUTES ---
// ========================================================

// --- Product & Image Routes ---
app.post('/api/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded.' });
    res.status(200).json({ imageUrl: req.file.path });
});

app.get("/api/products", async (req, res) => {
    const snapshot = await productsCollection.get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(products);
});

app.post("/api/products", async (req, res) => {
    const newProduct = req.body;
    const docRef = await productsCollection.add(newProduct);
    res.status(201).json({ id: docRef.id, ...newProduct });
});

app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    await productsCollection.doc(id).update(req.body);
    res.status(200).json({ id, ...req.body });
});

app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    await productsCollection.doc(id).delete();
    res.status(200).json({ message: `Product ${id} deleted.` });
});


// --- Payment Route (OPTIONAL) ---
if (razorpay) {
    app.post('/api/create-order', async (req, res) => {
        const { amount } = req.body;
        const options = {
            amount: Math.round(amount * 100), // Amount in paise
            currency: 'INR',
            receipt: `receipt_order_${new Date().getTime()}`,
        };

        try {
            const order = await razorpay.orders.create(options);
            console.log("Razorpay order created:", order);
            res.json(order);
        } catch (error) {
            console.error("Razorpay Error:", error);
            res.status(500).send("Error creating payment order");
        }
    });
}


// ========================================================
// --- 6. START THE SERVER ---
// ========================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
