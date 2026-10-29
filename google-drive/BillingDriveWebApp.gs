/**
 * BILLING APP → Google Drive Backup (Apps Script Web App)
 * Target Folder: RDSS T-10 GADCHIROLI / <Contractor Name> / <Contractor Name>_RA-<No>.xlsx
 * Behavior: Overwrites (replaces) existing file with the same name — no duplicates or timestamps.
 */

const ROOT_FOLDER_NAME = 'RDSS T-10 GADCHIROLI';

/** Connection test (doGet) */
function doGet(e) {
  return jsonOut({
    ok: true,
    status: 'success',
    app: 'billing-drive-backup',
    version: 3,
    time: new Date().toISOString(),
    rootFolder: ROOT_FOLDER_NAME
  });
}

/** File upload (doPost) */
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

    const fileName = clean_(body.fileName) || 'invoice.xlsx';
    // Overwrite existing file with same name so duplicate files with timestamps are NOT created
    const file = saveOrOverwriteFile_(contractorFolder, fileName, bytes, body.mimeType || MimeType.XLSX);

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

/** Folder mile to use, warna naya banao */
function getOrCreateFolder_(name, parent) {
  const it = parent ? parent.getFoldersByName(name) : DriveApp.getRootFolder().getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

/** Same bill file pehle se ho to use overwrite (replace) karo taaki duplicate/timestamped files na banein */
function saveOrOverwriteFile_(folder, name, bytes, mimeType) {
  const existing = folder.getFilesByName(name);
  while (existing.hasNext()) {
    try {
      existing.next().setTrashed(true);
    } catch(e) {}
  }
  return folder.createFile(name, bytes, mimeType);
}

/** Windows/folder ke liye safe naam */
function clean_(s) {
  return String(s == null ? '' : s).replace(/[\\/:*?"<>|]/g, '_').trim().substring(0, 120);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
