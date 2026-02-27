const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// API Key (Priority to Environment Variable)
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyAEorgxuu__sl4__SEwCa7aVgb1CIc9UTA";
const genAI = new GoogleGenerativeAI(API_KEY);

// 1. Image Processing API
app.post('/api/process-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ reply: "No image found." });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use Flash for faster image response
        const imagePart = {
            inlineData: {
                data: Buffer.from(fs.readFileSync(req.file.path)).toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const prompt = req.body.prompt || "Analyze this image and describe it clearly.";
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const replyText = response.text();

        // Cleanup file safely
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.json({ reply: replyText });
    } catch (error) {
        console.error("Image Error:", error);
        res.status(500).json({ reply: "AI is currently overloaded. Please wait a minute and try again." });
    }
});

// 2. Chat API
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ reply: "Message is empty." });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const result = await model.generateContent(message);
        const response = await result.response;
        
        res.json({ reply: response.text() });
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ reply: "Server is busy or API limit reached. Try refreshing." });
    }
});

app.listen(PORT, () => console.log(`System Online: Port ${PORT}`));
