// Use ES Module imports for consistency
import express from "express";
import admin from "firebase-admin";
import dotenv from "dotenv";
import cors from "cors";
import { readFileSync } from 'fs';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import Razorpay from 'razorpay'; // <-- ADDED: Import Razorpay

dotenv.config();

// --- 1. FIREBASE ADMIN SETUP ---
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
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


// --- 3. RAZORPAY INITIALIZATION (from your second file) ---
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// --- 4. EXPRESS APP SETUP ---
const app = express();
app.use(cors()); // Enable CORS for all routes
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

// ... (Your other product routes for UPDATE and DELETE are fine) ...
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


// --- NEW: Payment Route (from your second file) ---
// Note: Changed path to /api/create-order for consistency
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

