/**
 * Vercel Serverless Function: Telegram AI Study Agent
 * Tech Stack: Node.js (Vercel), Telegram Bot API, Google Gemini AI
 */

export default async function handler(req, res) {
    // HARDCODED CONFIGURATION (As requested)
    const CONFIG = {
        TELEGRAM_TOKEN: "8539545999:AAGPUpBrVsZGwMPpBXx5tghaHoTJEH9hrbo",
        GEMINI_API_KEY: "AIzaSyAghW7M5jQhPqW8hj-cFO1qic0qXHTsRzs", // Replace this with your Gemini Key
        STUDENT_ID: "7568961446"
    };

    const host = req.headers.host;

    // --- 1. WEBHOOK ACTIVATION (GET REQUEST) ---
    // Simply visit https://your-project.vercel.app/api/bot to activate
    if (req.method === 'GET') {
        try {
            const webhookUrl = `https://${host}/api/bot`;
            const setup = await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/setWebhook?url=${webhookUrl}`);
            const result = await setup.json();
            return res.status(200).send(`<h1>Bot Webhook Status</h1><pre>${JSON.stringify(result, null, 2)}</pre>`);
        } catch (e) {
            return res.status(500).send("Webhook Setup Failed: " + e.message);
        }
    }

    // --- 2. THE MAIN ENGINE (POST REQUEST) ---
    if (req.method === 'POST') {
        // Always reply to Telegram immediately to prevent timeout loops
        res.status(200).json({ ok: true });

        const update = req.body;
        if (!update) return;

        let chatId, userMessage, isCallback = false;

        // Parse Message or Button Click
        if (update.message && update.message.text) {
            chatId = update.message.chat.id;
            userMessage = update.message.text;
        } else if (update.callback_query) {
            chatId = update.callback_query.message.chat.id;
            userMessage = update.callback_query.data;
            isCallback = true;
        } else {
            return; // Ignore non-text updates (stickers, etc)
        }

        try {
            // SHOW "TYPING" INDICATOR
            await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendChatAction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, action: 'typing' })
            });

            // ROUTE COMMANDS
            if (userMessage === '/start' || userMessage.toLowerCase() === 'hello') {
                return await sendTelegramUI(CONFIG.TELEGRAM_TOKEN, chatId, 
                    "🧬 <b>Welcome to the AI Agentic Study Hub</b>\n\nI am your background tutor. I work even when the website is closed. Ask me anything about your 8th-10th grade syllabus!",
                    ["Class 10 Math", "Science Facts", "Social Science"]
                );
            }

            // AGENTIC AI PROCESSING
            const aiResponse = await callGeminiAgent(CONFIG.GEMINI_API_KEY, userMessage);
            
            await sendTelegramUI(
                CONFIG.TELEGRAM_TOKEN, 
                chatId, 
                aiResponse.text, 
                aiResponse.options
            );

        } catch (err) {
            console.error("Critical Error:", err);
            // Error Fallback Message
            await sendTelegramUI(CONFIG.TELEGRAM_TOKEN, chatId, "⚠️ I encountered a small glitch in my brain. Can you try rephrasing that?", ["Try Again", "Go to Menu"]);
        }
    }
}

// --- AGENTIC GENAI LOGIC ---
async function callGeminiAgent(apiKey, prompt) {
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `
        You are a Class 8-10 Study Agent. Help the student with: ${prompt}.
        Rules:
        1. Keep answers simple, formatted with bold HTML tags for key terms.
        2. Always suggest 3 relevant follow-up topics as buttons.
        3. Output MUST be valid JSON: {"text": "Your Answer...", "options": ["Option1", "Option2", "Option3"]}
        4. If it is a math problem, explain the steps.
    `;

    try {
        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemInstruction }] }]
            })
        });

        const data = await response.json();
        const rawOutput = data.candidates[0].content.parts[0].text;
        
        // Clean AI response to extract JSON (removes potential markdown code blocks)
        const jsonStr = rawOutput.replace(/```json|```/g, "").trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        return { 
            text: "I'm having trouble connecting to my AI core, but I'm still here! Let's try something simpler.", 
            options: ["Math", "Science", "History"] 
        };
    }
}

// --- TELEGRAM UI RENDERER ---
async function sendTelegramUI(token, chatId, text, buttons) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    // Construct Interactive Grid (2 columns)
    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
        const row = [{ text: buttons[i], callback_data: buttons[i] }];
        if (buttons[i + 1]) {
            row.push({ text: buttons[i + 1], callback_data: buttons[i + 1] });
        }
        inlineKeyboard.push(row);
    }

    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard }
    };

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}
