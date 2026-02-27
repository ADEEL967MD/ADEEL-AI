const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

// فائل اپ لوڈ کرنے کا سیٹ اپ (Multer)
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

const genAI = new GoogleGenerativeAI("AIzaSyAEorgxuu__sl4__SEwCa7aVgb1CIc9UTA");

// امیج اپ لوڈ اور پروسیسنگ (Image-to-Image)
app.post('/api/process-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ reply: "No image uploaded." });

        const prompt = req.body.prompt;
        const imagePath = req.file.path;

        // Gemini Vision ماڈل کا استعمال کریں
        const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
        const imagePart = {
            inlineData: {
                data: Buffer.from(fs.readFileSync(imagePath)).toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const instruction = `Analyze this image and the user's prompt: '${prompt}'. 
                             Generate a detailed, creative image prompt to create a NEW image that is a variation or edit of the original image as per user's request. 
                             Output ONLY the generated prompt, nothing else.`;

        const result = await model.generateContent([instruction, imagePart]);
        const response = await result.response;
        const generatedPrompt = response.text();

        // نیا امیج جنریٹ کریں (Pollinations service)
        const newImgUrl = `https://pollinations.ai/p/${encodeURIComponent(generatedPrompt)}?width=1024&height=1024&nologo=true`;

        // اپ لوڈ کی گئی فائل ڈیلیٹ کر دیں
        fs.unlinkSync(imagePath);

        res.json({ reply: `I have processed your image. Here is the variation: [IMAGE_START]${newImgUrl}[IMAGE_END]` });
    } catch (error) {
        res.status(500).json({ reply: "Error processing image." });
    }
});

// عام چیٹ اور امیج جنریشن (Text-to-Image)
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const prompt = `System Instructions:
        1. Act as an expert developer, creative assistant, and AI phone companion.
        2. Provide complete code, fixed, and production-ready.
        3. Create poetry based on emotions.
        4. If user asks for image generation, respond with a placeholder or generate via an external service.
        5. Respond in the user's language.
        6. For the phone call simulation, act as a friendly AI and respond in a concise, natural, spoken way.
        User: ${message}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let replyText = response.text();

        // امیج جنریشن (Text-to-Image)
        if (message.toLowerCase().includes("image") || message.toLowerCase().includes("photo")) {
            const imgUrl = `https://pollinations.ai/p/${encodeURIComponent(message)}?width=1024&height=1024&nologo=true`;
            replyText += `\n\n[IMAGE_START]${imgUrl}[IMAGE_END]`;
        }

        res.json({ reply: replyText });
    } catch (error) {
        res.status(500).json({ reply: "Error: System is currently busy." });
    }
});

// اپ لوڈز فولڈر بنائیں اگر موجود نہ ہو
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

app.listen(3000, () => console.log('System Running on port 3000...'));
