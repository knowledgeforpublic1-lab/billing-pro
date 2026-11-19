'use strict';
// Offline only: reads the verified backup, never initializes Firebase or Drive.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const crypto = require('node:crypto');
const { configKind } = require('../api/storage-router');

async function inventory(directory) {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    if (!manifest.verified || manifest.databaseWrites !== 0) throw Error('Verified read-only backup manifest required');
    const archive = path.join(directory, 'documents.ndjson'), hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(archive); let bytes = 0;
    stream.on('data', chunk => { hash.update(chunk); bytes += chunk.length; });
    const roots = new Map(), chunks = [], groups = {}; let count = 0;
    for await (const line of readline.createInterface({ input: stream, crlfDelay: Infinity })) {
        if (!line) continue; count++;
        const document = JSON.parse(line), relative = document.name.split('/documents/')[1];
        const [collection, id, sub] = relative.split('/');
        if (sub === 'chunks') { chunks.push({ relative, bytes: Buffer.byteLength(line) + 1 }); continue; }
        const business = collection === 'billing_states' ? 'bill' : collection === 'reconciliation_states' ? 'reconciliation' : collection === 'default_configs' ? configKind(id) : collection === 'daily_progress_control' && /^(report_|shared_report_|entry_event_)/.test(id) ? 'daily' : null;
        const group = business || 'security-or-coordination';
        groups[group] = groups[group] || { documents: 0, backupBytes: 0, activeChunkDocuments: 0, obsoleteChunkDocuments: 0, activeChunkBackupBytes: 0, obsoleteChunkBackupBytes: 0 };
        groups[group].documents++; groups[group].backupBytes += Buffer.byteLength(line) + 1;
        roots.set(relative, { group, chunkVersion: document.fields?.chunkVersion?.stringValue, chunks: Number(document.fields?.totalChunks?.integerValue || 0), chunked: document.fields?._isChunked?.booleanValue });
    }
    if (bytes !== manifest.bytes || count !== manifest.documents || hash.digest('hex') !== manifest.sha256) throw Error('Backup checksum/count mismatch');
    for (const chunk of chunks) {
        const [parent, id] = chunk.relative.split('/chunks/'), root = roots.get(parent);
        if (!root) throw Error('Chunk parent absent from backup inventory');
        const active = root.chunked && (root.chunkVersion ? id.startsWith(root.chunkVersion + '_') && Number(id.slice(root.chunkVersion.length + 1)) < root.chunks : Number(id) < root.chunks);
        const label = active ? 'active' : 'obsolete', group = groups[root.group];
        group[label + 'ChunkDocuments']++; group[label + 'ChunkBackupBytes'] += chunk.bytes;
    }
    return { verified: true, projectId: manifest.projectId, snapshotTime: manifest.readTime, backupSha256: manifest.sha256,
        documents: count, backupBytes: bytes, groups, writes: 0,
        measurement: 'Lossless REST backup byte sizes, not Firestore billed storage or index footprint. No cleanup performed.' };
}
module.exports = inventory;
if (require.main === module) {
    const directory = path.resolve(process.argv[2] || 'backups/pre-drive-first-20261118/live-firestore');
    inventory(directory).then(report => {
        fs.writeFileSync(path.join(directory, 'storage-inventory.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
