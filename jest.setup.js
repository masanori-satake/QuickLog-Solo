import 'fake-indexeddb/auto';

if (typeof structuredClone === 'undefined') {
    global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}
