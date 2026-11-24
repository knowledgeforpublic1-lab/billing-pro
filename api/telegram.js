/**
 * Telegram Bot Notification and Reporting Service for BillingPro
 * Bot: @rdss_t10_gad_bot
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9210192291:AAF2VBd7Xoi3_cMbpkLuYzFoHk57qqbMSdY';
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '881238938';

function getTelegramApiUrl(method) {
    return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
}

/**
 * Send a message to a Telegram chat.
 * Defaults to DEFAULT_CHAT_ID if chatId is not provided.
 */
async function sendMessage(text, options = {}) {
    if (process.env.NODE_ENV === 'test') {
        return { success: true, messageId: 999999, mocked: true };
    }

    const chatId = options.chatId || DEFAULT_CHAT_ID;
    if (!chatId || !BOT_TOKEN) {
        console.warn('[Telegram] Cannot send message: Missing BOT_TOKEN or chatId');
        return { success: false, error: 'Missing token or chatId' };
    }

    try {
        const payload = {
            chat_id: chatId,
            text,
            parse_mode: options.parseMode || 'HTML',
            disable_web_page_preview: options.disablePreview !== false
        };

        if (options.replyMarkup) {
            payload.reply_markup = options.replyMarkup;
        }

        const res = await fetch(getTelegramApiUrl('sendMessage'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; BillingProBot/1.0; +https://billing-pro-dusky.vercel.app)'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(12000)
        });

        const data = await res.json();
        if (!data.ok) {
            console.error('[Telegram] API error:', data.description);
            return { success: false, error: data.description };
        }
        return { success: true, messageId: data.result?.message_id };
    } catch (err) {
        console.error('[Telegram] Send error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Send real-time alert when a contractor submits a daily progress report.
 */
async function sendDailyProgressAlert({ contractorName, feeder, date, report, savedBy, isFinal, itemsMap }) {
    try {
        const quantities = (report && report.quantities) || {};
        const manpower = (report && report.manpower) || {};
        const remarks = (report && report.remarks) || '';

        const leader = Number(manpower.leader) || 0;
        const skilled = Number(manpower.skilled) || 0;
        const unskilled = Number(manpower.unskilled) || 0;
        const totalLabour = leader + skilled + unskilled;

        // Extract entered materials
        const enteredItems = [];
        for (const [id, qty] of Object.entries(quantities)) {
            const num = Number(qty);
            if (num > 0) {
                const itemInfo = (itemsMap && itemsMap[id]) || { name: id, unit: '' };
                enteredItems.push({
                    name: itemInfo.name || id,
                    unit: itemInfo.unit || '',
                    qty: num
                });
            }
        }

        let materialSection = '<i>Koi material enter nahi kiya gaya</i>';
        if (enteredItems.length > 0) {
            materialSection = enteredItems
                .slice(0, 15)
                .map(it => `• <b>${it.name}:</b> ${it.qty} ${it.unit}`.trim())
                .join('\n');
            if (enteredItems.length > 15) {
                materialSection += `\n<i>...aur ${enteredItems.length - 15} items</i>`;
            }
        }

        const message = `
⚡ <b>RDSS T-10 — DAILY PROGRESS SUBMITTED</b>

👷 <b>Contractor:</b> ${escapeHtml(contractorName || 'Unknown')}
📍 <b>Feeder / Site:</b> ${escapeHtml(feeder || 'General Site')}
📅 <b>Date:</b> <code>${date}</code>
🔒 <b>Status:</b> ${isFinal ? '🔒 Final / Locked' : '🟢 Open / Draft'}

👥 <b>Manpower Deployed (${totalLabour} Workers):</b>
  • Team Leader: <b>${leader}</b>
  • Skilled Labour: <b>${skilled}</b>
  • Unskilled Labour: <b>${unskilled}</b>

📦 <b>Materials Consumed (${enteredItems.length} Items):</b>
${materialSection}

${remarks ? `📝 <b>Field Remarks:</b>\n<i>${escapeHtml(remarks)}</i>\n` : ''}
👤 <b>Saved by:</b> ${escapeHtml(savedBy || 'Contractor / Supervisor')}
🕒 <b>Time:</b> ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}
`.trim();

        return await sendMessage(message);
    } catch (e) {
        console.error('[Telegram] Alert format error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Handle incoming webhook commands from Telegram (/start, /today, /pending, etc.)
 */
async function handleWebhookUpdate(update, context = {}) {
    if (!update || !update.message) return { ok: true };

    const msg = update.message;
    const chatId = msg.chat?.id;
    const text = (msg.text || '').trim();
    const sender = msg.from?.first_name || 'Engineer';

    if (!text || !chatId) return { ok: true };

    const cmd = text.toLowerCase().split(' ')[0];

    if (cmd === '/start' || cmd === '/help') {
        const welcome = `
👋 <b>Namaste ${escapeHtml(sender)}!</b>

Main <b>RDSS T-10 Gadchiroli Site Diary Bot</b> hoon.
Aap yahan se site daily progress, manpower aur stock reports dekh sakte hain.

📋 <b>Available Commands:</b>
• <code>/today</code> ya <code>/aaj</code> — Aaj ka site progress & labour summary
• <code>/pending</code> — Aaj kin contractors ki entry baaki hai
• <code>/status</code> — Bot & system connection status
• <code>/link</code> — Site diary entry share link

🔔 Site par koi bhi contractor entry save karega to aapko turant alert yahan milega.
`.trim();
        await sendMessage(welcome, { chatId });
        return { ok: true };
    }

    if (cmd === '/status' || cmd === '/test') {
        const reply = `
✅ <b>System Online & Connected!</b>

🤖 <b>Bot:</b> @rdss_t10_gad_bot
🆔 <b>Your Chat ID:</b> <code>${chatId}</code>
🕒 <b>Server Time:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
⚡ <b>Project:</b> RDSS GADCHIROLI (T-10)
`.trim();
        await sendMessage(reply, { chatId });
        return { ok: true };
    }

    if (cmd === '/link' || cmd === '/share') {
        const linkMsg = `
🔗 <b>Daily Progress Register Links:</b>

🌐 <b>Live Web App:</b>
https://billing-pro-dusky.vercel.app/daily-progress.html

📱 <b>Contractor Entry Form:</b>
https://billing-pro-dusky.vercel.app/daily-progress.html?contractor=all
`.trim();
        await sendMessage(linkMsg, { chatId });
        return { ok: true };
    }

    if (cmd === '/today' || cmd === '/aaj' || cmd === '/summary') {
        const todayStr = getTodayKolkata();
        const summary = await buildDailySummary(todayStr, context);
        await sendMessage(summary, { chatId });
        return { ok: true };
    }

    if (cmd === '/pending') {
        const todayStr = getTodayKolkata();
        const pending = await buildPendingReport(todayStr, context);
        await sendMessage(pending, { chatId });
        return { ok: true };
    }

    // Default reply for unrecognized commands
    await sendMessage(`Command samajh nahi aaya. Kripya <code>/help</code> ya <code>/today</code> type karein.`, { chatId });
    return { ok: true };
}

function getTodayKolkata() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function buildDailySummary(dateStr, context = {}) {
    try {
        const db = context.db;
        let reports = [];
        let contractors = [];

        if (db && typeof db.readDailyProgressData === 'function') {
            const data = await db.readDailyProgressData();
            reports = (data && data.reports) || [];
            contractors = (data && data.contractors) || [];
        } else if (context.dailyProgressService && typeof context.dailyProgressService.listReports === 'function') {
            reports = await context.dailyProgressService.listReports();
        }

        const dayReports = reports.filter(r => r.date === dateStr && !r.deleted);

        let totalLeader = 0;
        let totalSkilled = 0;
        let totalUnskilled = 0;
        const activeFeeders = new Set();
        const activeContractorNames = [];

        dayReports.forEach(r => {
            const mp = r.manpower || {};
            totalLeader += Number(mp.leader) || 0;
            totalSkilled += Number(mp.skilled) || 0;
            totalUnskilled += Number(mp.unskilled) || 0;
            if (r.locationName || r.feeder) activeFeeders.add(r.locationName || r.feeder);
            const cName = r.contractorName || r.contractorId;
            if (cName && !activeContractorNames.includes(cName)) activeContractorNames.push(cName);
        });

        const totalWorkers = totalLeader + totalSkilled + totalUnskilled;

        return `
📊 <b>DAILY WORK PROGRESS SUMMARY</b>
📅 <b>Date:</b> <code>${dateStr}</code>
⚡ <b>Project:</b> RDSS GADCHIROLI (T-10)

👥 <b>Total Manpower On Site: ${totalWorkers} Workers</b>
  • Team Leaders: <b>${totalLeader}</b>
  • Skilled Labour: <b>${totalSkilled}</b>
  • Unskilled Labour: <b>${totalUnskilled}</b>

📝 <b>Reports Submitted:</b> ${dayReports.length} Site Reports
👷 <b>Active Teams:</b> ${activeContractorNames.length ? activeContractorNames.join(', ') : 'Koi submission nahi'}
📍 <b>Active Feeders:</b> ${activeFeeders.size ? Array.from(activeFeeders).join(', ') : 'None'}

<i>Detailed report dekhne ke liye portal login karein.</i>
`.trim();
    } catch (e) {
        return `⚠️ Summary generate karne me samasya aayi: ${e.message}`;
    }
}

async function buildPendingReport(dateStr, context = {}) {
    try {
        const db = context.db;
        let reports = [];
        let contractors = [];

        if (db && typeof db.readDailyProgressData === 'function') {
            const data = await db.readDailyProgressData();
            reports = (data && data.reports) || [];
            contractors = (data && data.contractors) || [];
        }

        const submittedContractorIds = new Set(
            reports.filter(r => r.date === dateStr && !r.deleted).map(r => String(r.contractorId).toLowerCase())
        );

        const pending = contractors.filter(c => !submittedContractorIds.has(String(c.id).toLowerCase()));

        let list = '';
        if (pending.length === 0) {
            list = '🎉 <b>Sabhi contractors ne aaj ki report submit kar di hai!</b>';
        } else {
            list = pending.slice(0, 20).map((c, i) => `${i + 1}. <b>${c.name}</b> (${c.feeder || 'Site'})`).join('\n');
            if (pending.length > 20) list += `\n<i>...aur ${pending.length - 20} contractors</i>`;
        }

        return `
⏳ <b>PENDING DAILY ENTRY REPORT</b>
📅 <b>Date:</b> <code>${dateStr}</code>
❌ <b>Pending Submissions:</b> ${pending.length} / ${contractors.length} Contractors

${list}
`.trim();
    } catch (e) {
        return `⚠️ Pending report nikalne me error: ${e.message}`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

module.exports = {
    BOT_TOKEN,
    DEFAULT_CHAT_ID,
    sendMessage,
    sendDailyProgressAlert,
    handleWebhookUpdate,
    buildDailySummary,
    buildPendingReport
};
