/**
 * Vercel Serverless Function: Ultimate AI Study Agent
 * Features: Auto-Recovery, HTML-Safe Rendering, Persistent Menus, Detailed Error Logs
 */

export default async function handler(req, res) {
    const CONFIG = {
        TOKEN: "8539545999:AAGPUpBrVsZGwMPpBXx5tghaHoTJEH9hrbo",
        GEMINI_KEY: "AIzaSyA_GgAydJn0nsEUNxi5vI1PwkpxP5RphFE", 
        ADMIN_ID: "7568961446"
    };

    // 1. WEBHOOK REGISTRATION (GET)
    if (req.method === 'GET') {
        const host = req.headers.host;
        const url = `https://api.telegram.org/bot${CONFIG.TOKEN}/setWebhook?url=https://${host}/api/bot`;
        const response = await fetch(url);
        const data = await response.json();
        return res.status(200).send(`<h1>Bot Online</h1><pre>${JSON.stringify(data, null, 2)}</pre>`);
    }

    // 2. MESSAGE HANDLING (POST)
    if (req.method === 'POST') {
        res.status(200).send('OK'); // Critical: Stops Telegram from retrying
        const update = req.body;
        if (!update) return;

        const chatId = update.message ? update.message.chat.id : (update.callback_query ? update.callback_query.message.chat.id : null);
        const userText = update.message ? update.message.text : (update.callback_query ? update.callback_query.data : null);

        if (!chatId || !userText) return;

        try {
            await sendAction(CONFIG.TOKEN, chatId, 'typing');

            // --- COMMAND ROUTING ---
            if (userText === '/start') {
                return await sendAdvancedUI(CONFIG.TOKEN, chatId, 
                    "<b>🌟 Welcome to the AI Study Hub!</b>\n\nI am your background agent for Class 8-10. I can explain complex science, solve math, or create custom quizzes.\n\n<i>What are we learning today?</i>",
                    ["Class 10 Math 📐", "Physics Lab 🧪", "History Dates ⏳", "Quick Quiz 🧠"]
                );
            }

            // --- AGENTIC AI CORE ---
            const aiResult = await fetchAgenticAI(CONFIG.GEMINI_KEY, userText);

            // --- DELIVERY ---
            await sendAdvancedUI(CONFIG.TOKEN, chatId, aiResult.text, aiResult.options);

        } catch (error) {
            // ERROR REPORTING: The bot will now tell you exactly what failed.
            const errorTrace = `<b>⚠️ System Alert</b>\n\n<b>Error:</b> <code>${error.message}</code>\n<b>Trace:</b> <i>The bot failed to process the AI response. Check API Key or JSON format.</i>`;
            await sendAdvancedUI(CONFIG.TOKEN, chatId, errorTrace, ["Try Again 🔄", "Main Menu 🏠"]);
        }
    }
}

// --- INTELLIGENT AGENTIC LOGIC ---
async function fetchAgenticAI(apiKey, userPrompt) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    const systemContext = `
    You are a Class 8-10 Expert Tutor. User asked: "${userPrompt}".
    Return ONLY a JSON object:
    {
      "text": "Your answer in HTML format (use <b>, <i>, <code>). Max 4000 chars.",
      "options": ["Option 1", "Option 2", "Option 3"]
    }
    Rules: 
    - If user says 'Quick Quiz', generate an MCQ.
    - If user says 'Math', show step-by-step in <code> blocks.
    - Suggest high-value follow-up buttons.
    `;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemContext }] }] })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API Error: ${errorData.error.message || response.statusText}`);
    }

    const data = await response.json();
    let aiText = data.candidates[0].content.parts[0].text;

    // SANITIZER: Handles AI wrapping JSON in markdown blocks
    const cleanJson = aiText.replace(/```json|```/g, "").trim();
    
    try {
        return JSON.parse(cleanJson);
    } catch (e) {
        // Fallback if AI refuses to return JSON
        return { 
            text: `<b>Note:</b> I've simplified my response formatting:\n\n${aiText}`, 
            options: ["Back to Menu"] 
        };
    }
}

// --- ADVANCED TELEGRAM RENDERER ---
async function sendAdvancedUI(token, chatId, text, options) {
    const inlineKeyboard = [];
    // Build 2-column dynamic buttons
    for (let i = 0; i < options.length; i += 2) {
        const row = [{ text: options[i], callback_data: options[i] }];
        if (options[i + 1]) row.push({ text: options[i + 1], callback_data: options[i + 1] });
        inlineKeyboard.push(row);
    }

    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML', // Switched from MarkdownV2 to HTML for 100% stability
        reply_markup: {
            inline_keyboard: inlineKeyboard,
            // Persistent Reply Menu at the bottom
            keyboard: [
                [{ text: "Class 10 Math 📐" }, { text: "Physics Lab 🧪" }],
                [{ text: "Quick Quiz 🧠" }, { text: "/start" }]
            ],
            resize_keyboard: true
        }
    };

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errorDetail = await res.json();
        throw new Error(`Telegram API Error: ${errorDetail.description}`);
    }
}

async function sendAction(token, chatId, action) {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: action })
    });
}
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
