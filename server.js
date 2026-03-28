const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('.'));  // serves index.html and index.css

// Initialize Firebase
const serviceAccount = require('./serviceAccount.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// This is the endpoint index.html posts to
app.post('/saveTaps.php', async (req, res) => {
    try {
        const sessionId = req.body.id;
        const platform = req.body.var;
        const tapsRaw = req.body.taps;

        console.log("--- Incoming POST ---");
        console.log("Session ID:", sessionId);
        console.log("Platform:", platform);
        console.log("Raw taps:", tapsRaw);       // ← add this to see exactly what arrives

        // tapsRaw looks like: ["{...}","{...}"]
        // Each element is itself a JSON string, so parse twice
        let tapsArray;
        try {
            tapsArray = JSON.parse(tapsRaw);
        } catch (e) {
            console.error("First parse failed:", e.message);
            return res.status(400).send("Bad taps format");
        }

        console.log("Parsed array length:", tapsArray.length);

        const batch = db.batch();

        tapsArray.forEach((tapItem, index) => {
            // Each item may be a string OR already an object
            let tap;
            if (typeof tapItem === 'string') {
                tap = JSON.parse(tapItem);   // second parse
            } else {
                tap = tapItem;
            }

            console.log(`Tap ${index + 1}:`, tap);  // ← see each tap

            const duration = tap.endTimestamp - tap.startTimestamp;
            const docRef = db.collection('tap_logs').doc();

            batch.set(docRef, {
                sessionId: sessionId,
                platform: platform,
                tapSequenceNumber: tap.tapSequenceNumber,
                startTimestamp: tap.startTimestamp,
                endTimestamp: tap.endTimestamp,
                duration: duration,
                interfaceType: tap.interface,
                interfaceSequence: tap.interfaceSequence,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        console.log("✅ Batch committed to Firestore successfully");
        res.send('Data saved successfully');

    } catch (err) {
        console.error("❌ Server error:", err);
        res.status(500).send('Error saving data');
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));