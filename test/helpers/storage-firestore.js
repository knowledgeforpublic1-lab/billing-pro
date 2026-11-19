'use strict';
// Isolated serializable Firestore double: rejects reads after writes just like Firestore.
module.exports = function fakeFirestore() {
    const rows = new Map(); let clock = 0, tail = Promise.resolve();
    const copy = value => value == null ? value : structuredClone(value);
    function snapshot(path) {
        const entry = rows.get(path);
        return { id: path.split('/').at(-1), ref: ref(path), exists: !!entry,
            updateTime: entry ? { seconds: entry.at, nanoseconds: 0 } : undefined,
            data: () => copy(entry?.data) };
    }
    function ref(path) {
        return { path, id: path.split('/').at(-1), parent: { id: path.split('/').at(-2) },
            get: async () => snapshot(path), set: async value => rows.set(path, { data: copy(value), at: ++clock }),
            collection: name => collection(path + '/' + name) };
    }
    function collection(path, filters = []) {
        const query = { path, query: true, doc: id => ref(path + '/' + id),
            select: () => query,
            where: (field, op, value) => collection(path, [...filters, [field, value]]),
            get: async () => {
                const docs = [...rows.keys()].filter(key => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1)
                    .map(snapshot).filter(snap => filters.every(([key, value]) => snap.data()[key] === value));
                return { docs, size: docs.length, empty: !docs.length };
            } };
        return query;
    }
    const db = { rows, collection, seed: async (path, data) => ref(path).set(data),
        runTransaction(fn) {
            const task = tail.then(async () => {
                let writing = false; const writes = [];
                const result = await fn({
                    get: async target => { if (writing) throw Error('Transaction read after write'); return target.query ? target.get() : snapshot(target.path); },
                    set(target, value) { writing = true; writes.push([target.path, copy(value)]); },
                    update(target, value) {
                        writing = true; const data = snapshot(target.path).data();
                        for (const [key, next] of Object.entries(value)) { const parts = key.split('.'); let parent = data; while (parts.length > 1) parent = parent[parts.shift()]; parent[parts[0]] = next; }
                        writes.push([target.path, data]);
                    }
                });
                for (const [path, data] of writes) rows.set(path, { data, at: ++clock });
                return copy(result);
            });
            tail = task.catch(() => {}); return task;
        } };
    return db;
};
