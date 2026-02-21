/**
 * Vercel Serverless Function: AI Study Agent (Unified & Optimized)
 */

export default async function handler(req, res) {
    const CONFIG = {
        TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN, // Use Environment Variables!
        GEMINI_KEY: process.env.GEMINI_API_KEY,
        MODEL: "gemini-2.5-flash" // Stable model name
    };

    // 1. SETUP WEBHOOK (GET REQUEST)
    if (req.method === 'GET') {
        try {
            const host = req.headers.host;
            const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/setWebhook?url=https://${host}/api/bot`;
            const response = await fetch(url);
            const data = await response.json();
            return res.status(200).json({ status: "Webhook Set", detail: data });
        } catch (e) {
            return res.status(500).send("Setup Failed: " + e.message);
        }
    }

    // 2. HANDLE MESSAGES (POST REQUEST)
    if (req.method === 'POST') {
        const update = req.body;
        if (!update) return res.status(200).send('No Body');

        const chatId = update.message?.chat.id || update.callback_query?.message.chat.id;
        const userText = update.message?.text || update.callback_query?.data;

        if (!chatId || !userText) return res.status(200).send('Ignored');

        try {
            // Signal "Typing..." to user
            await sendChatAction(CONFIG.TELEGRAM_TOKEN, chatId, 'typing');

            // Route Commands
            if (userText === '/start') {
                await sendTelegramUI(CONFIG.TELEGRAM_TOKEN, chatId, 
                    "🧬 <b>Welcome to the AI Study Hub!</b>\n\nI am your tutor for Class 8-10. I can explain science, solve math, or create quizzes.\n\n<i>What are we learning today?</i>",
                    ["Class 10 Math 📐", "Physics Lab 🧪", "Quick Quiz 🧠"]
                );
            } else {
                // Fetch AI Response
                const aiResponse = await callGeminiAgent(CONFIG.GEMINI_KEY, CONFIG.MODEL, userText);
                await sendTelegramUI(CONFIG.TELEGRAM_TOKEN, chatId, aiResponse.text, aiResponse.options);
            }

            return res.status(200).send('OK');
        } catch (error) {
            console.error("Critical Error:", error);
            await sendTelegramUI(CONFIG.TELEGRAM_TOKEN, chatId, 
                `⚠️ <b>System Error</b>\n<code>${error.message}</code>`, 
                ["Retry 🔄", "Main Menu 🏠"]
            );
            return res.status(200).send('Error Handled');
        }
    }
}

// --- CORE AI LOGIC ---
async function callGeminiAgent(apiKey, model, prompt) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const systemInstruction = `
        Role: Class 8-10 Expert Tutor. 
        User Query: "${prompt}"
        Rules:
        1. Answer clearly using HTML (<b>, <i>, <code>).
        2. If it's a math problem, provide step-by-step logic in <code> blocks.
        3. ALWAYS return valid JSON in this format:
        {"text": "your response", "options": ["Option 1", "Option 2", "Option 3"]}
    `;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemInstruction }] }] })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Gemini API Error");

    const rawOutput = data.candidates[0].content.parts[0].text;
    
    // Clean potential markdown code blocks from AI response
    const jsonStr = rawOutput.replace(/```json|```/g, "").trim();
    
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        return { 
            text: `<b>Response:</b>\n\n${rawOutput}`, 
            options: ["Next Topic", "Main Menu"] 
        };
    }
}

// --- TELEGRAM RENDERER ---
async function sendTelegramUI(token, chatId, text, buttons) {
    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
        const row = [{ text: buttons[i], callback_data: buttons[i] }];
        if (buttons[i + 1]) row.push({ text: buttons[i + 1], callback_data: buttons[i + 1] });
        inlineKeyboard.push(row);
    }

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: inlineKeyboard,
                keyboard: [[{ text: "Quick Quiz 🧠" }, { text: "/start" }]],
                resize_keyboard: true
            }
        })
    });
}

async function sendChatAction(token, chatId, action) {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: action })
    });
}
ext updates (stickers, etc)
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
