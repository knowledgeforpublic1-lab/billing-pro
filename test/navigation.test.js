const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const saved = new Map();
let options;
const source = fs.readFileSync('js/core/app.js', 'utf8');
const context = { window: {}, console, localStorage: { getItem(k) { return saved.get(k); }, setItem(k,v) { saved.set(k,v); } }, Vue: { createApp(value) { options=value; return { directive() {}, config: {}, mount() { return {}; } }; } } };
vm.runInNewContext(source, context);
const app = { closeRecoColumnFilter() {}, $nextTick() {} };
for (const [field,key,value] of [['currentView','billing_current_view','detail'],['selectedActivityKey','billing_selected_activity_key','907'],['selectedPoleScheduleKey','billing_selected_pole_schedule_key','1220']]) {
    const watch = options.watch[field];
    assert.equal(watch.flush, 'sync', 'Navigation is saved before an immediate refresh');
    watch.handler.call(app,value);
    assert.equal(saved.get(key),value);
}
const init = source.match(/selectedActivityKey: (\(function\(\) \{[\s\S]*?\}\)\(\))/)[1];
assert.equal(vm.runInNewContext(init, context),'907','Reload restores the selected activity instead of default 1220');
saved.set('billing_selected_activity_key','CUSTOM');
assert.equal(vm.runInNewContext(init, context),'CUSTOM','Saved custom sheets survive before cloud activities load');
console.log('Navigation: immediate view/activity/pole selection persistence and refresh restore passed.');
