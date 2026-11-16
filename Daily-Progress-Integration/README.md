# Daily Progress — integration files

Is folder mein doosri website ke saath integration ke liye zaroori source, original Excel template aur supplied workbook ka data hai. Yeh existing application mein merge karne wala module hai; standalone deployment project nahi hai.

## Files

| Path | Kaam |
| --- | --- |
| `app/page.tsx` | Contractor selection, mobile/desktop UI, consumption, manpower, stock aur reports |
| `app/globals.css` | Mobile aur desktop styles |
| `app/export.ts` | Original Excel template mein date-wise export; 30 dates per sheet |
| `app/layout.tsx` | Optional layout reference; host site ka existing root layout overwrite na karein |
| `app/api/data/route.ts` | GET/POST backend, validation aur concurrent-edit checks |
| `data/seed.json` | Supplied Excel ka contractor, 401 item rows aur September 2026 ke 30 daily reports |
| `data/stock-issues.json` | Empty stock handover file; actual stock abhi user se aana hai |
| `db/schema.ts` | Contractor, daily report aur material issue database schema |
| `drizzle/0000_spooky_champions.sql` | Naye database ke liye table creation SQL |
| `public/template.xlsx` | User ka original Excel template, formatting ke saath |
| `public/favicon.svg` | Optional site icon |
| `dependencies.json` | Existing project se li gayi required package versions; dependency list only |

Build output, node_modules, Git history, caches, local QA database, test entries, screenshots, hosting project IDs aur credentials include nahi hain.

## Data ko akela integrate karna ho

`data/seed.json` aur `data/stock-issues.json` use karein. UI/backend files ki zaroorat nahi hai.

Seed structure:

```text
contractor: {id, name, project, feeder, engineer}
items: [{id, row, code, name, unit}]
records: [{date, quantities: {itemId: number}, manpower, remarks}]
manpower: {leader, skilled, unskilled, tractor, augur, room}
```

- Date format `YYYY-MM-DD`; quantities numbers hain.
- `item.id` original worksheet row ki string hai. `code` unique nahi hai: same code alag rows/units mein aa sakta hai. Items ko sirf code se merge na karein; ID, unit aur row mapping verify karein.
- Records is seed ke ek contractor ke hain. Host database mein import karte waqt `contractor.id` ko har report ke saath associate karein.
- `leader`, `skilled`, `unskilled` headcounts hain. `tractor`, `augur`, `room` template ke daily charges/rates hain, headcount nahi.
- Issue record structure: `{id, contractorId, date, itemId, quantity, reference}`. `quantity` positive number hona chahiye.
- Stock file ka `issues` array abhi empty hai. Actual stock invent nahi kiya gaya hai. Is handover file ko API automatically import nahi karti; importer ya POST issue action se records add karein.
- Balance = selected date tak total issued minus selected date tak saved consumption, per contractor and item.

**Data boundary:** Yeh supplied Excel ka historical seed hai, online production database ka latest backup nahi. Live website par baad mein save hue reports/contractors/issues export karne hon to authenticated backend/database se alag export lena hoga. Local QA entries include nahi hain.

## UI aur backend merge karna ho

1. Existing React/Next-compatible host project mein `dependencies.json` ki required dependencies merge karein. Host ki existing versions aur runtime compatibility check karein.
2. Page component ko host ke desired route par mount karein. Root `app/layout.tsx` optional reference hai. CSS mein global selectors (`body`, `header`, `nav`, etc.) hain: host site par merge karte waqt scope/prefix karein ya isolated stylesheet use karein.
3. `app/export.ts` aur `data/seed.json` ke relative imports actual folder placement ke hisaab se update karein.
4. Backend presently Cloudflare Workers + D1 use karta hai: `import {env} from 'cloudflare:workers'` aur `env.DB`. A compatible runtime mein D1 binding `DB` configure karein. Doosre backend/database par API ke database calls adapt karne honge. Frontend-only website mein current backend as-is nahi chalega.
5. SQL ko sirf naye/compatible database mein migration workflow se apply karein. Existing tables ko recreate ya overwrite na karein. GET initial seed ko `INSERT OR IGNORE` se add karta hai.
6. Host authentication aur server-side access checks add/preserve karein. Original hosted site's private access gate is folder ke saath transfer nahi hota.
7. Page mein `fetch('/api/data')` GET/POST aur export mein `fetch('/template.xlsx')` paths hain. Host ka actual API/template path different ho to in paths ko update karein. Brand link `/` bhi host navigation ke hisaab se update karein.
8. Template ko host ke static public path par rakhein. Optional favicon ko existing host icon se replace kar sakte hain.

## API contract

`GET /api/data` returns `{contractors, reports, issues}`. Returned report mein `contractorId`, `date`, `quantities`, `manpower`, `remarks`, `version` hote hain.

`POST /api/data` accepts these actions:

```json
{
  "action": "contractor",
  "contractor": {
    "name": "TEAM NAME",
    "project": "PROJECT NAME",
    "feeder": "FEEDER NAME",
    "engineer": "SUPERVISOR NAME"
  }
}
```

```json
{
  "action": "issue",
  "contractorId": "existing-contractor-id",
  "date": "2026-11-16",
  "itemId": "15",
  "quantity": 100,
  "reference": "CHALLAN-001"
}
```

```json
{
  "action": "report",
  "contractorId": "existing-contractor-id",
  "date": "2026-11-16",
  "quantities": {"15": 5},
  "manpower": {"leader": 1, "skilled": 7, "unskilled": 6, "tractor": 0, "augur": 0, "room": 0},
  "remarks": "",
  "version": 0
}
```

Examples illustrative hain; actual stock nahi hain. New report ke liye `version: 0`; existing report update karne ke liye GET se latest version bhejein. `409` par refresh karke edit reconcile karein. Successful report save `{ok:true}` return karta hai; contractor creation `{id}` return karti hai. Invalid inputs `400`, conflicting edits `409`, storage failures `500` return karte hain.

Backend same-origin requests expect karta hai. Separate domain se integration ke liye host backend/proxy mein authentication aur required CORS policy explicitly implement karein. Credentials browser code mein na rakhein.

## Verification after integration

Contractor/date switch, save/reload, stock balance, mobile/desktop layout aur one-day/31-day Excel exports check karein. Original website source aur live deployment is packaging se change nahi hue hain.
