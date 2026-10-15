# Google Drive Backup — Setup Guide

Billing app se "☁️ Save Bill to Drive" dabate hi Tax Invoice `.xlsx` aapke
**Google Drive** me save ho jayega. Ye ek **Google Apps Script Web App** ke through
chalta hai (official docs: [Web Apps](https://developers.google.com/apps-script/guides/web),
[Quotas](https://developers.google.com/apps-script/guides/services/quotas)).

## Kaise kaam karta hai

```
Billing App (browser)
   ↓  POST /api/gdrive-upload  (Vercel server — CORS nahi, badi file bhi chalti hai)
Google Apps Script Web App (doPost)   ← aapka script.google.com project
   ↓  DriveApp.createFile(...)
Google Drive:  RDSS T-10 GADCHIROLI / <Contractor Name> / Tax_Invoice_<BillNo>_All_Sheets.xlsx
```

## One-time setup (5 minute)

1. **[script.new](https://script.new)** kholo (jiss Google account se Drive chalani hai,
   usi se login rahein — file usi ke Drive me jayegi).
2. Jo code `google-drive/BillingDriveWebApp.gs` me hai, poora copy karke editor me
   paste karo (default `function myFunction() {...}` delete karke).
3. Top right: **Deploy → New deployment**.
   - Type: **Web app**
   - Description: `Billing Drive Backup`
   - **Execute as: Me**
   - **Who has access: Anyone** ← ye zaroori hai, warna server se call fail hoga
4. **Deploy** karo → pehli baar **Authorize access** → apna account chuno →
   *Advanced → Go to project (unsafe) → Allow* (aapka apna script hai).
5. Jo URL mile, wo **`/exec`** se end hota hai — copy karo.
   (`/dev` wala sirf testing ke liye hai, app me `/exec` hi paste karna hai.)
6. Billing app kholo → **Tax Invoice** view → **☁️ Save Bill to Drive** button →
   modal khulega → URL paste karke **💾 Save & Connect**.
7. **🔍 Test Connection** dabao — "Google Drive webhook CONNECTED ✅" aana chahiye.
8. Invoice ki saari zaroori fields (Contractor, Bill No, Date...) bharkar
   **☁️ Save Bill to Drive** dabao → file Drive me aa jayegi.

> Code kabhi bhi badlo to **Deploy → Manage deployments → ✏️ → Version: New version**
> se dobara deploy karna padega. Purana URL waisa hi rahega.

## Connection status app me

- Modal me **● Connected** tabhi dikhta hai jab URL save ho.
- **🔍 Test Connection** → Vercel server se Apps Script ka `doGet` call hota hai;
  sahi JSON aaya matlab deployment + access dono theek hain.

## Common errors

| Message | Wajah / Fix |
|---|---|
| `Invalid webhook URL` | URL `https://script.google.com/macros/s/.../exec` hona chahiye (`/dev` nahi). |
| `Unauthorized: valid x-api-key header required` | Vercel/local par `API_KEY` set hai par browser me `localStorage.setItem('billing_api_key','<same-value>')` nahi kiya. |
| `Google Apps Script error (404/405)` | Deployment galat hai — *New deployment → Web app → Anyone* se banao, `/exec` URL lagao. |
| `File bahut bada hai (>5MB)` | Vercel serverless ka request limit 4.5MB hai. Bill workbook 3.3MB se chhota rakho, warna file seedha download karke manually upload karo. |
| `Google Drive save fail: ...` | Modal me diya gaya error message dekho — Apps Script ki asli error (`ok:false`) app tak pahunchti hai. Apps Script ke **Executions** log (script.google.com → Executions) bhi check karo. |
| Save ho gaya par Drive me purana content | Naam same hone par purana file replace hone ke bajaye naya timestamped file banta hai — `Tax_Invoice_RA-01_All_Sheets_15102026_143055.xlsx`. |

## Limits (official quotas se)

- Apps Script web app POST body: ~50 MB tak OK.
- Hamara Vercel proxy: request body max **4.5 MB** (base64 ke hisaab se file ≈ 3.3 MB).
- Drive storage aapke Google account quota me aata hai.
