/**
 * Vercel Serverless Function: AI Study Agent
 * Rebuilt from scratch for stability and speed.
 */

export default async function handler(req, res) {
    // 1. ENVIRONMENT VARIABLE CHECK (Prevents crashes)
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!TELEGRAM_TOKEN || !GEMINI_API_KEY) {
        console.error("CRITICAL: Missing API Keys in Vercel Environment Variables.");
        return res.status(500).json({ error: "Server Configuration Error. Missing Keys." });
    }

    // 2. WEBHOOK SETUP ROUTE (Browser GET request)
    if (req.method === 'GET') {
        try {
            const host = req.headers.host;
            const setupUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=https://${host}/api/tbot.js`;
            const response = await fetch(setupUrl);
            const data = await response.json();
            return res.status(200).json({ status: "Webhook Configured", details: data });
        } catch (error) {
            return res.status(500).json({ error: "Failed to set webhook", details: error.message });
        }
    }

    // 3. MESSAGE HANDLING ROUTE (Telegram POST request)
    if (req.method === 'POST') {
        const update = req.body;
        
        // Ignore empty updates
        if (!update) return res.status(200).send('No body');

        // Safely extract chat ID and user input (handles both text and button clicks)
        const chatId = update.message?.chat.id || update.callback_query?.message.chat.id;
        const userText = update.message?.text || update.callback_query?.data;

        // If it's not a text message or button click, ignore it and return 200 to clear the queue
        if (!chatId || !userText) return res.status(200).send('Ignored update type');

        try {
            // Instantly show typing indicator
            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, action: 'typing' })
            });

            // Handle Welcome Command
            if (userText === '/start') {
                await sendTelegramMessage(TELEGRAM_TOKEN, chatId, 
                    "🧬 <b>Welcome to the AI Study Hub!</b>\n\nI am your fast, background tutor. I can explain science, solve math, or create custom quizzes.\n\n<i>What are we learning today?</i>",
                    ["Class 10 Math 📐", "Physics Lab 🧪", "Quick Quiz 🧠"]
                );
                return res.status(200).send('OK');
            }

            // Fetch AI Response
            const aiResponse = await getGeminiResponse(GEMINI_API_KEY, userText);
            
            // Send AI Response to User
            await sendTelegramMessage(TELEGRAM_TOKEN, chatId, aiResponse.text, aiResponse.options);

            // Successfully close the Vercel function
            return res.status(200).send('OK');

        } catch (error) {
            console.error("Bot Execution Error:", error);
            await sendTelegramMessage(TELEGRAM_TOKEN, chatId, 
                `⚠️ <b>System Alert</b>\nMy brain had a small hiccup. Please try asking that differently.\n\n<i>Log: ${error.message}</i>`,
                ["Main Menu 🏠"]
            );
            return res.status(200).send('Error handled gracefully');
        }
    }

    // Reject non GET/POST requests
    return res.status(405).send('Method Not Allowed');
}

// --- AI BRAIN LOGIC ---
async function getGeminiResponse(apiKey, prompt) {
    const MODEL = "gemini-2.5-flash"; // Fast and capable
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    
    const systemPrompt = `
        You are a Class 8-10 Study Agent. User Query: "${prompt}"
        Rules:
        1. Keep it concise. Use HTML tags (<b>, <i>, <code>).
        2. ALWAYS return your output as a valid JSON object.
        3. Format: {"text": "your educational response", "options": ["Follow up 1", "Follow up 2"]}
    `;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
    });

    if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    
    // Safety Net: Strip markdown formatting if Gemini forgets to output pure JSON
    const cleanJsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        return JSON.parse(cleanJsonString);
    } catch (parseError) {
        // Fallback if AI fails to format JSON correctly
        return {
            text: `<b>Here is what I found:</b>\n\n${rawText}`,
            options: ["Next Topic", "Main Menu 🏠"]
        };
    }
}

// --- TELEGRAM UI LOGIC ---
async function sendTelegramMessage(token, chatId, text, buttons) {
    const inlineKeyboard = [];
    
    // Create a 2-column grid for buttons
    if (buttons && buttons.length > 0) {
        for (let i = 0; i < buttons.length; i += 2) {
            const row = [{ text: buttons[i], callback_data: buttons[i] }];
            if (buttons[i + 1]) row.push({ text: buttons[i + 1], callback_data: buttons[i + 1] });
            inlineKeyboard.push(row);
        }
    }

    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: inlineKeyboard
        }
    };

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}
  
