/**
 * BILLING APP → Google Drive Backup & File Browser (Apps Script Web App)
 * Target Folder: RDSS T-10 GADCHIROLI / <Contractor Name> / <Contractor Name>_RA-<No>.xlsx
 * Features:
 *  - Save & overwrite bill files without duplicates (cleans any old timestamped copies)
 *  - Browse / list all saved invoice workbooks
 *  - Retrieve file data (base64) to open directly in Billing Pro app
 */

const ROOT_FOLDER_NAME = 'RDSS T-10 GADCHIROLI';

/** Connection test & read operations (doGet) */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = (p.action || '').trim();

    if (action === 'list') {
      return listFiles_(p.folderName || ROOT_FOLDER_NAME);
    }
    if (action === 'getFile') {
      return getFile_(p.fileId);
    }

    return jsonOut({
      ok: true,
      status: 'success',
      app: 'billing-drive-backup',
      version: 5,
      time: new Date().toISOString(),
      rootFolder: ROOT_FOLDER_NAME
    });
  } catch (err) {
    return jsonOut({ ok: false, status: 'error', error: String((err && err.message) || err) });
  }
}

/** File upload & actions (doPost) */
function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (!raw) return jsonOut({ ok: false, status: 'error', error: 'Empty POST body' });

    const body = JSON.parse(raw);

    // Support action in POST body
    if (body.action === 'list') {
      return listFiles_(body.folderName || ROOT_FOLDER_NAME);
    }
    if (body.action === 'getFile') {
      return getFile_(body.fileId);
    }

    if (!body.fileData || !body.fileName) {
      return jsonOut({ ok: false, status: 'error', error: 'fileData / fileName missing in payload' });
    }

    const bytes = Utilities.base64Decode(body.fileData);
    const rootName = clean_(body.folderName) || ROOT_FOLDER_NAME;
    const root = getOrCreateFolder_(rootName);
    const contractorFolder = getOrCreateFolder_(clean_(body.contractorName) || 'Unknown_Contractor', root);

    const fileName = clean_(body.fileName) || 'invoice.xlsx';
    // Overwrite existing file with same name and clean any old timestamped duplicate copies
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

/** List all bills in root folder and contractor subfolders */
function listFiles_(rootName) {
  try {
    const root = getOrCreateFolder_(clean_(rootName) || ROOT_FOLDER_NAME);
    const files = [];

    function scan(folder, contractorName) {
      const it = folder.getFiles();
      while (it.hasNext()) {
        const f = it.next();
        const name = f.getName();
        if (name.toLowerCase().endsWith('.xlsx') || name.toLowerCase().endsWith('.xls')) {
          files.push({
            id: f.getId(),
            name: name,
            contractor: contractorName || '',
            size: f.getSize(),
            url: f.getUrl(),
            updatedAt: f.getLastUpdated().toISOString()
          });
        }
      }
    }

    // Scan root and contractor folders
    scan(root, '');
    const sub = root.getFolders();
    while (sub.hasNext()) {
      const subFolder = sub.next();
      scan(subFolder, subFolder.getName());
    }

    // Sort newest first
    files.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return jsonOut({
      ok: true,
      status: 'success',
      rootFolder: root.getName(),
      rootFolderUrl: root.getUrl(),
      totalFiles: files.length,
      files: files
    });
  } catch (err) {
    return jsonOut({ ok: false, status: 'error', error: String((err && err.message) || err) });
  }
}

/** Retrieve file content as base64 */
function getFile_(fileId) {
  try {
    if (!fileId) return jsonOut({ ok: false, error: 'fileId is required' });
    const file = DriveApp.getFileById(fileId);
    const bytes = file.getBlob().getBytes();
    const base64 = Utilities.base64Encode(bytes);
    return jsonOut({
      ok: true,
      status: 'success',
      id: file.getId(),
      fileName: file.getName(),
      size: file.getSize(),
      mimeType: file.getMimeType(),
      updatedAt: file.getLastUpdated().toISOString(),
      fileData: base64
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

/** Same bill file pehle se ho to use overwrite (replace) karo aur purani timestamped duplicate files ko delete karo */
function saveOrOverwriteFile_(folder, name, bytes, mimeType) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.substring(0, dot) : name;
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    const fName = f.getName();
    // Match exact name OR old timestamped files (e.g. Manohar Traders_RA-04_29102026_123107.xlsx)
    if (fName === name || (fName.startsWith(base + '_') && (fName.endsWith('.xlsx') || fName.endsWith('.xls')))) {
      try {
        f.setTrashed(true);
      } catch(e) {}
    }
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
