const dns = require('dns');
if (dns && typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

/**
 * Telegram Bot Notification and Reporting Service for BillingPro
 * Bot: @rdss_t10_gad_bot
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9210192291:AAFMKGnaN3VWIVimGt6UOfRvh51ANML3XG4';
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

const MAIN_KEYBOARD = {
    keyboard: [
        [{ text: '📊 Dashboard' }, { text: '📅 Aaj Ka Report' }],
        [{ text: '⏳ Pending List' }, { text: '📈 Is Hafte Ka' }],
        [{ text: '🗓️ Is Mahine Ka' }, { text: '👷 Contractor Wise' }],
        [{ text: '🔗 Web Portal Link' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
};

function makeWebhookReply(chatId, text, options = {}) {
    const res = {
        ok: true,
        method: 'sendMessage',
        chat_id: chatId,
        text,
        parse_mode: options.parseMode || 'HTML',
        disable_web_page_preview: options.disablePreview !== false
    };
    if (options.replyMarkup !== false) {
        res.reply_markup = options.replyMarkup || MAIN_KEYBOARD;
    }
    return res;
}

/**
 * Handle incoming webhook commands from Telegram (/start, /today, /pending, etc.)
 */
async function handleWebhookUpdate(update, context = {}) {
    if (!update || !update.message) return { ok: true };

    const msg = update.message;
    const chatId = msg.chat?.id;
    const rawText = (msg.text || '').trim();
    const sender = msg.from?.first_name || 'Engineer';

    if (!rawText || !chatId) return { ok: true };

    const text = rawText.toLowerCase();
    const parts = rawText.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();

    if (cmd === '/start' || cmd === '/help') {
        const welcome = `
👋 <b>Namaste ${escapeHtml(sender)}!</b>

Main <b>RDSS T-10 Gadchiroli Site Diary & Executive Dashboard Bot</b> hoon.
Aap yahan se poore project ki daily, weekly, monthly aur contractor-wise progress report ek click me dekh sakte hain.

📋 <b>Aap niche diye gaye buttons ko tap kar sakte hain:</b>
• 📊 <b>Dashboard</b> — Overall executive project summary
• 📅 <b>Aaj Ka Report</b> — Aaj ki site progress & total labour
• ⏳ <b>Pending List</b> — Aaj kin contractors ki entry baaki hai
• 📈 <b>Is Hafte Ka</b> — Pichle 7 dino ka contractor-wise kaam
• 🗓️ <b>Is Mahine Ka</b> — Pure mahine ka progress aur material consumption
• 👷 <b>Contractor Wise</b> — Har contractor ka alag-alag performance

🔔 <i>Site par koi bhi contractor entry save karega to turant yahan alert aayega.</i>
`.trim();
        return makeWebhookReply(chatId, welcome);
    }

    if (cmd === '/dashboard' || cmd === '/menu' || text.includes('dashboard')) {
        const dash = await buildExecutiveDashboard(context);
        return makeWebhookReply(chatId, dash);
    }

    if (cmd === '/status' || cmd === '/test') {
        const reply = `
✅ <b>System Online & Connected!</b>

🤖 <b>Bot:</b> @rdss_t10_gad_bot
🆔 <b>Your Chat ID:</b> <code>${chatId}</code>
🕒 <b>Server Time:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
⚡ <b>Project:</b> RDSS GADCHIROLI (T-10)
`.trim();
        return makeWebhookReply(chatId, reply);
    }

    if (cmd === '/link' || cmd === '/share' || text.includes('portal') || text.includes('link')) {
        const linkMsg = `
🔗 <b>Daily Progress Register Links:</b>

🌐 <b>Live Web Dashboard:</b>
https://billing-pro-dusky.vercel.app/daily-progress.html

📱 <b>Contractor Entry Form:</b>
https://billing-pro-dusky.vercel.app/daily-progress.html?contractor=all
`.trim();
        return makeWebhookReply(chatId, linkMsg);
    }

    if (cmd === '/today' || cmd === '/aaj' || text.includes('aaj ka')) {
        const todayStr = getTodayKolkata();
        const summary = await buildDailySummary(todayStr, context);
        return makeWebhookReply(chatId, summary);
    }

    if (cmd === '/pending' || text.includes('pending')) {
        const todayStr = getTodayKolkata();
        const pending = await buildPendingReport(todayStr, context);
        return makeWebhookReply(chatId, pending);
    }

    if (cmd === '/week' || cmd === '/weekly' || cmd === '/hafta' || text.includes('hafte')) {
        const weekly = await buildWeeklySummary(context);
        return makeWebhookReply(chatId, weekly);
    }

    if (cmd === '/month' || cmd === '/monthly' || cmd === '/mahina' || text.includes('mahine')) {
        const monthly = await buildMonthlySummary(null, context);
        return makeWebhookReply(chatId, monthly);
    }

    if (cmd === '/contractor' || cmd === '/contractors' || text.includes('contractor')) {
        const contractorReport = await buildContractorWiseReport(arg, context);
        return makeWebhookReply(chatId, contractorReport);
    }

    // Default reply with menu buttons
    return makeWebhookReply(chatId, `Command samajh nahi aaya. Kripya niche diye gaye buttons me se select karein ya <code>/dashboard</code> type karein.`);
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

function getDateDaysAgo(daysAgo) {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    d.setDate(d.getDate() - daysAgo);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function getAllData(context = {}) {
    const db = context.db;
    let reports = [];
    let contractors = [];
    let items = [];

    if (db && typeof db.readDailyProgressData === 'function') {
        const data = await db.readDailyProgressData();
        reports = (data && data.reports) || [];
        contractors = (data && data.contractors) || [];
        items = (data && data.items) || [];
    } else if (context.dailyProgressService && typeof context.dailyProgressService.listReports === 'function') {
        reports = await context.dailyProgressService.listReports();
    }
    return { reports, contractors, items };
}

async function buildExecutiveDashboard(context = {}) {
    try {
        const { reports, contractors } = await getAllData(context);
        const todayStr = getTodayKolkata();
        const weekStartStr = getDateDaysAgo(6);
        const monthPrefix = todayStr.slice(0, 7);

        // Today stats
        const todayReports = reports.filter(r => r.date === todayStr && !r.deleted);
        let todayWorkers = 0;
        todayReports.forEach(r => {
            const mp = r.manpower || {};
            todayWorkers += (Number(mp.leader) || 0) + (Number(mp.skilled) || 0) + (Number(mp.unskilled) || 0);
        });

        // Week stats (last 7 days)
        const weekReports = reports.filter(r => r.date >= weekStartStr && r.date <= todayStr && !r.deleted);
        let weekWorkers = 0;
        const weekContractors = new Set();
        weekReports.forEach(r => {
            const mp = r.manpower || {};
            weekWorkers += (Number(mp.leader) || 0) + (Number(mp.skilled) || 0) + (Number(mp.unskilled) || 0);
            if (r.contractorName || r.contractorId) weekContractors.add(r.contractorName || r.contractorId);
        });

        // Month stats
        const monthReports = reports.filter(r => r.date && r.date.startsWith(monthPrefix) && !r.deleted);
        let monthWorkers = 0;
        monthReports.forEach(r => {
            const mp = r.manpower || {};
            monthWorkers += (Number(mp.leader) || 0) + (Number(mp.skilled) || 0) + (Number(mp.unskilled) || 0);
        });

        const pendingCount = Math.max(0, contractors.length - todayReports.length);

        return `
⚡ <b>RDSS T-10 GADCHIROLI — EXECUTIVE BOT DASHBOARD</b>
🕒 <b>Update:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}

📅 <b>TODAY (${todayStr}):</b>
• Manpower on Site: <b>${todayWorkers} Workers</b>
• Reports Submitted: <b>${todayReports.length}</b> / ${contractors.length} Contractors
• Submissions Pending: <b>${pendingCount} Pending</b>

📈 <b>THIS WEEK (Last 7 Days):</b>
• Total Manpower Deployed: <b>${weekWorkers} Man-days</b>
• Active Work Reports: <b>${weekReports.length} Reports</b>
• Active Contractor Teams: <b>${weekContractors.size} Contractors</b>

🗓️ <b>THIS MONTH (${monthPrefix}):</b>
• Total Monthly Manpower: <b>${monthWorkers} Man-days</b>
• Total Reports Recorded: <b>${monthReports.length} Reports</b>

🔘 <b>Quick Action Buttons:</b>
Niche diye gaye buttons se kisi bhi report ko ek tap me kholein 👇
`.trim();
    } catch (e) {
        return `⚠️ Dashboard generation error: ${e.message}`;
    }
}

async function buildWeeklySummary(context = {}) {
    try {
        const { reports, contractors } = await getAllData(context);
        const todayStr = getTodayKolkata();
        const startStr = getDateDaysAgo(6);

        const weekReports = reports.filter(r => r.date >= startStr && r.date <= todayStr && !r.deleted);

        let totalLeader = 0;
        let totalSkilled = 0;
        let totalUnskilled = 0;
        const contractorMap = {};

        weekReports.forEach(r => {
            const mp = r.manpower || {};
            const l = Number(mp.leader) || 0;
            const s = Number(mp.skilled) || 0;
            const u = Number(mp.unskilled) || 0;
            totalLeader += l;
            totalSkilled += s;
            totalUnskilled += u;

            const cKey = String(r.contractorId || r.contractorName || 'Unknown');
            if (!contractorMap[cKey]) {
                contractorMap[cKey] = {
                    name: r.contractorName || cKey,
                    feeder: r.locationName || r.feeder || 'Site',
                    days: new Set(),
                    totalWorkers: 0
                };
            }
            contractorMap[cKey].days.add(r.date);
            contractorMap[cKey].totalWorkers += (l + s + u);
        });

        const totalLabourDays = totalLeader + totalSkilled + totalUnskilled;
        const sortedContractors = Object.values(contractorMap).sort((a, b) => b.days.size - a.days.size || b.totalWorkers - a.totalWorkers);

        let contractorLines = '';
        if (sortedContractors.length === 0) {
            contractorLines = '<i>Pichle 7 dino me koi report submit nahi hui.</i>';
        } else {
            contractorLines = sortedContractors.map((c, i) => {
                return `<b>${i + 1}. ${escapeHtml(c.name)}</b> (${escapeHtml(c.feeder)})\n   • Days Active: <b>${c.days.size} din</b> | Labour: <b>${c.totalWorkers} man-days</b>`;
            }).join('\n');
        }

        return `
📈 <b>WEEKLY WORK PROGRESS REPORT (7 DAYS)</b>
📅 <b>Range:</b> <code>${startStr}</code> se <code>${todayStr}</code>
⚡ <b>Project:</b> RDSS GADCHIROLI (T-10)

👥 <b>Total Manpower Deployed: ${totalLabourDays} Man-days</b>
  • Team Leaders: <b>${totalLeader}</b>
  • Skilled Labour: <b>${totalSkilled}</b>
  • Unskilled Labour: <b>${totalUnskilled}</b>

📝 <b>Total Reports Submitted:</b> ${weekReports.length} Reports
👷 <b>Active Contractors:</b> ${sortedContractors.length} / ${contractors.length || sortedContractors.length}

📊 <b>Contractor-wise Performance:</b>
${contractorLines}
`.trim();
    } catch (e) {
        return `⚠️ Weekly report error: ${e.message}`;
    }
}

async function buildMonthlySummary(monthStr, context = {}) {
    try {
        const { reports, contractors, items } = await getAllData(context);
        const targetMonth = monthStr || getTodayKolkata().slice(0, 7);
        const [year, monthNum] = targetMonth.split('-');
        const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = `${monthNames[Number(monthNum)] || monthNum} ${year}`;

        const monthReports = reports.filter(r => r.date && r.date.startsWith(targetMonth) && !r.deleted);

        let totalLeader = 0;
        let totalSkilled = 0;
        let totalUnskilled = 0;
        const contractorMap = {};
        const materialTotals = {};

        const itemInfoMap = {};
        (items || []).forEach(it => {
            if (it && it.id) itemInfoMap[it.id] = { name: it.name || it.id, unit: it.unit || '' };
        });

        monthReports.forEach(r => {
            const mp = r.manpower || {};
            const l = Number(mp.leader) || 0;
            const s = Number(mp.skilled) || 0;
            const u = Number(mp.unskilled) || 0;
            totalLeader += l;
            totalSkilled += s;
            totalUnskilled += u;

            const cKey = String(r.contractorId || r.contractorName || 'Unknown');
            if (!contractorMap[cKey]) {
                contractorMap[cKey] = {
                    name: r.contractorName || cKey,
                    feeder: r.locationName || r.feeder || 'Site',
                    days: new Set(),
                    totalWorkers: 0
                };
            }
            contractorMap[cKey].days.add(r.date);
            contractorMap[cKey].totalWorkers += (l + s + u);

            const q = r.quantities || {};
            for (const [id, val] of Object.entries(q)) {
                const num = Number(val) || 0;
                if (num > 0) {
                    materialTotals[id] = (materialTotals[id] || 0) + num;
                }
            }
        });

        const totalLabourDays = totalLeader + totalSkilled + totalUnskilled;
        const sortedContractors = Object.values(contractorMap).sort((a, b) => b.days.size - a.days.size || b.totalWorkers - a.totalWorkers);

        let contractorLines = '';
        if (sortedContractors.length === 0) {
            contractorLines = '<i>Is mahine me koi submission nahi mila.</i>';
        } else {
            contractorLines = sortedContractors.map((c, i) => {
                return `${i + 1}. <b>${escapeHtml(c.name)}</b>\n   • Days Worked: <b>${c.days.size} Days</b> | Man-days: <b>${c.totalWorkers}</b> | Site: ${escapeHtml(c.feeder)}`;
            }).join('\n');
        }

        const topMaterials = Object.entries(materialTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([id, qty]) => {
                const info = itemInfoMap[id] || { name: id, unit: '' };
                return `• <b>${escapeHtml(info.name)}:</b> ${qty} ${escapeHtml(info.unit)}`.trim();
            });

        let materialSection = '';
        if (topMaterials.length > 0) {
            materialSection = `\n📦 <b>Key Material Installed This Month:</b>\n` + topMaterials.join('\n');
        }

        return `
🗓️ <b>MONTHLY PROGRESS REPORT — ${monthLabel.toUpperCase()}</b>
⚡ <b>Project:</b> RDSS GADCHIROLI (T-10)

👥 <b>Total Monthly Manpower: ${totalLabourDays} Man-days</b>
  • Team Leaders: <b>${totalLeader}</b>
  • Skilled Labour: <b>${totalSkilled}</b>
  • Unskilled Labour: <b>${totalUnskilled}</b>

📝 <b>Total Site Reports:</b> ${monthReports.length} Reports
👷 <b>Active Contractors:</b> ${sortedContractors.length} / ${contractors.length || sortedContractors.length}

🏆 <b>Contractor-wise Performance:</b>
${contractorLines}
${materialSection}
`.trim();
    } catch (e) {
        return `⚠️ Monthly report error: ${e.message}`;
    }
}

async function buildContractorWiseReport(query, context = {}) {
    try {
        const { reports, contractors } = await getAllData(context);
        const q = (query || '').toLowerCase().trim();

        if (q && q !== 'all' && q !== 'list') {
            const matched = contractors.find(c =>
                (c.id && c.id.toLowerCase().includes(q)) || (c.name && c.name.toLowerCase().includes(q))
            );
            const cId = matched ? matched.id : q;
            const cName = matched ? matched.name : query;
            const cFeeder = matched ? matched.feeder : 'Site';

            const cReports = reports.filter(r =>
                String(r.contractorId).toLowerCase() === String(cId).toLowerCase() ||
                (r.contractorName && r.contractorName.toLowerCase().includes(q))
            ).sort((a, b) => b.date.localeCompare(a.date));

            if (cReports.length === 0) {
                return `⚠️ <b>${escapeHtml(cName)}</b> ka koi daily progress report nahi mila.`;
            }

            let totalLabour = 0;
            const daysSet = new Set();
            const last5 = cReports.slice(0, 5).map(r => {
                const mp = r.manpower || {};
                const tot = (Number(mp.leader) || 0) + (Number(mp.skilled) || 0) + (Number(mp.unskilled) || 0);
                return `• <code>${r.date}</code>: <b>${tot} Workers</b> (${r.locationName || r.feeder || 'Site'})${r.remarks ? ` - <i>${escapeHtml(r.remarks.slice(0, 40))}</i>` : ''}`;
            }).join('\n');

            cReports.forEach(r => {
                daysSet.add(r.date);
                const mp = r.manpower || {};
                totalLabour += (Number(mp.leader) || 0) + (Number(mp.skilled) || 0) + (Number(mp.unskilled) || 0);
            });

            return `
👷 <b>CONTRACTOR REPORT: ${escapeHtml(cName)}</b>
📍 <b>Feeder / Site:</b> ${escapeHtml(cFeeder)}

📊 <b>Overall Summary:</b>
• Total Days Reported: <b>${daysSet.size} Days</b>
• Total Manpower Deployed: <b>${totalLabour} Man-days</b>
• Latest Entry Date: <code>${cReports[0].date}</code>

🕒 <b>Recent 5 Entries:</b>
${last5}
`.trim();
        }

        const todayStr = getTodayKolkata();
        const curMonth = todayStr.slice(0, 7);

        const list = (contractors.length ? contractors : [{ id: 'all', name: 'All Contractors' }]).map((c, i) => {
            const hasToday = reports.some(r => String(r.contractorId).toLowerCase() === String(c.id).toLowerCase() && r.date === todayStr && !r.deleted);
            const monthDays = new Set(reports.filter(r => String(r.contractorId).toLowerCase() === String(c.id).toLowerCase() && r.date.startsWith(curMonth) && !r.deleted).map(r => r.date)).size;
            const badge = hasToday ? '🟢' : '🔴';
            return `${badge} <b>${c.name}</b> (${c.feeder || 'Site'})\n   • Aaj: ${hasToday ? 'Submitted ✅' : 'Pending ⏳'} | Month: ${monthDays} days`;
        }).join('\n\n');

        return `
👷 <b>ALL CONTRACTORS PROGRESS STATUS</b>
📅 <b>Date:</b> <code>${todayStr}</code>
⚡ <b>Project:</b> RDSS GADCHIROLI (T-10)

${list}

💡 <i>Kisi contractor ki deep report dekhne ke liye type karein:</i>
<code>/contractor [name]</code> (jaise: <code>/contractor mangesh</code>)
`.trim();
    } catch (e) {
        return `⚠️ Contractor report error: ${e.message}`;
    }
}

module.exports = {
    BOT_TOKEN,
    DEFAULT_CHAT_ID,
    sendMessage,
    sendDailyProgressAlert,
    handleWebhookUpdate,
    buildDailySummary,
    buildPendingReport,
    buildWeeklySummary,
    buildMonthlySummary,
    buildContractorWiseReport,
    buildExecutiveDashboard
};
