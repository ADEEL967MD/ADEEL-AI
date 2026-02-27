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

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyAEorgxuu__sl4__SEwCa7aVgb1CIc9UTA");

app.post('/api/process-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ reply: "No image uploaded." });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const imagePart = {
            inlineData: {
                data: Buffer.from(fs.readFileSync(req.file.path)).toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const prompt = req.body.prompt || "Analyze this image and provide a detailed description or edit instructions.";
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const replyText = response.text();

        fs.unlinkSync(req.file.path);

        if (prompt.toLowerCase().includes("edit") || prompt.toLowerCase().includes("variation")) {
            const newImgUrl = `https://pollinations.ai/p/${encodeURIComponent(replyText)}?width=1024&height=1024&nologo=true`;
            return res.json({ reply: `Processed: [IMAGE_START]${newImgUrl}[IMAGE_END]` });
        }

        res.json({ reply: replyText });
    } catch (error) {
        res.status(500).json({ reply: "Error processing image." });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const systemPrompt = `Act as an expert developer and AI assistant. Provide complete, fixed, and final code if asked. Generate poetry or images based on user intent. Current user message: ${message}`;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        let replyText = response.text();

        if (message.toLowerCase().includes("image") || message.toLowerCase().includes("photo")) {
            const imgUrl = `https://pollinations.ai/p/${encodeURIComponent(message)}?width=1024&height=1024&nologo=true`;
            replyText += `\n\n[IMAGE_START]${imgUrl}[IMAGE_END]`;
        }

        res.json({ reply: replyText });
    } catch (error) {
        res.status(500).json({ reply: "System is busy, try again." });
    }
});

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
