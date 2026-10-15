/**
 * BILLING APP → Google Drive backup (Apps Script Web App)
 * Setup steps: google-drive/README.md
 *
 * Deploy: script.google.com → Deploy > New deployment > Web app
 *   Execute as: Me | Who has access: Anyone
 *   Jo /exec URL mile, use billing app ke "Google Drive Settings" modal me paste karo.
 *
 * Flow: Billing app → /api/gdrive-upload (Vercel) → yahan (doPost) → Drive folder
 * Drive me structure:
 *   RDSS T-10 GADCHIROLI/
 *     └── <Contractor Firm Name>/
 *           └── Tax_Invoice_<BillNo>_All_Sheets.xlsx
 */

const ROOT_FOLDER_NAME = 'RDSS T-10 GADCHIROLI';

/** Connection test — app ka "Test Connection" button isse GET maarta hai */
function doGet(e) {
  return jsonOut({
    ok: true,
    status: 'success',
    app: 'billing-drive-backup',
    version: 2,
    time: new Date().toISOString(),
    rootFolder: ROOT_FOLDER_NAME
  });
}

/**
 * File upload. Body (JSON, Content-Type text/plain):
 * { folderName, contractorName, billNo, fileName, fileData(base64), mimeType }
 */
function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (!raw) return jsonOut({ ok: false, status: 'error', error: 'Empty POST body' });

    const body = JSON.parse(raw);
    if (!body.fileData || !body.fileName) {
      return jsonOut({ ok: false, status: 'error', error: 'fileData / fileName missing in payload' });
    }

    const bytes = Utilities.base64Decode(body.fileData);
    const rootName = clean_(body.folderName) || ROOT_FOLDER_NAME;
    const root = getOrCreateFolder_(rootName);
    const contractorFolder = getOrCreateFolder_(clean_(body.contractorName) || 'Unknown_Contractor', root);

    const fileName = uniqueFileName_(contractorFolder, clean_(body.fileName) || 'invoice.xlsx');
    const file = contractorFolder.createFile(fileName, bytes, body.mimeType || MimeType.XLSX);

    return jsonOut({
      ok: true,
      status: 'success',
      fileName: file.getName(),
      fileId: file.getId(),
      url: file.getUrl(),
      size: file.getSize(),
      folder: rootName + ' / ' + contractorFolder.getName(),
      billNo: body.billNo || '',
      savedAt: new Date().toISOString()
    });
  } catch (err) {
    return jsonOut({ ok: false, status: 'error', error: String((err && err.message) || err) });
  }
}

/** Folder mile to use, warna banao */
function getOrCreateFolder_(name, parent) {
  const it = parent ? parent.getFoldersByName(name) : DriveApp.getRootFolder().getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

/** Naam ka file pehle se hai to timestamp lagao (purane bill overwrite na hon) */
function uniqueFileName_(folder, name) {
  const it = folder.getFilesByName(name);
  if (!it.hasNext()) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.substring(0, dot) : name;
  const ext = dot > 0 ? name.substring(dot) : '';
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'ddMMyyyy_HHmmss');
  return base + '_' + stamp + ext;
}

/** Windows/folder ke liye unsafe characters hatao */
function clean_(s) {
  return String(s == null ? '' : s).replace(/[\\/:*?"<>|]/g, '_').trim().substring(0, 120);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
