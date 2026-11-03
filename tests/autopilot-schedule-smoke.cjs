const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('public/admin.html', 'utf8');
const start = source.indexOf('function apGenerateSchedule(');
assert.notEqual(start, -1, 'apGenerateSchedule must exist in admin.html');
const end = source.indexOf('\n}', start);
assert.notEqual(end, -1, 'apGenerateSchedule function closing brace must exist');
const functionSource = source.slice(start, end + 2);
const apGenerateSchedule = vm.runInNewContext(`${functionSource}; apGenerateSchedule`, {
  Date, Math, Set, Number, String, Error
});

const batch100 = apGenerateSchedule(100, [1, 2, 3, 4, 5, 6, 7], '09:00', 5, '2030-01-01');
assert.equal(batch100.length, 100, 'a batch of 100 products must produce 100 schedule entries');
const slots = [...new Set(batch100)];
assert.equal(slots.length, 20, '100 products at 5 products/slot must use 20 unique slots');
for (const slot of slots) {
  assert.equal(batch100.filter(value => value === slot).length, 5, 'each full slot must contain five products');
}
for (let i = 1; i < slots.length; i++) {
  assert.ok(Date.parse(slots[i]) > Date.parse(slots[i - 1]), 'scheduled slots must advance forward');
}

const weekdays = apGenerateSchedule(9, [1, 3, 5], '09:00', 1, '2030-01-01');
assert.equal(weekdays.length, 9);
for (const value of weekdays) {
  const localDay = new Date(value).getDay() || 7;
  assert.ok([1, 3, 5].includes(localDay), 'schedule must only use selected weekdays');
}

const after = batch100[0];
const appended = apGenerateSchedule(2, [1, 2, 3, 4, 5, 6, 7], '09:00', 1, '2030-01-01', after);
assert.ok(Date.parse(appended[0]) > Date.parse(after), 'appended schedule must not overlap an existing future slot');
assert.throws(() => apGenerateSchedule(1, [], '09:00', 1, '2030-01-01'), /Pilih minimal satu hari/);
assert.throws(() => apGenerateSchedule(1, [1], 'bad', 1, '2030-01-01'), /Jam publikasi tidak valid/);

const customStart = source.indexOf('function apLocalCustomSchedule(');
assert.notEqual(customStart, -1, 'apLocalCustomSchedule must exist');
const customEnd = source.indexOf('\n}', customStart);
assert.notEqual(customEnd, -1, 'apLocalCustomSchedule closing brace must exist');
const customSource = source.slice(customStart, customEnd + 2);
const apLocalCustomSchedule = vm.runInNewContext(`${customSource}; apLocalCustomSchedule`, { Date, String, Error, Number });
assert.equal(apLocalCustomSchedule({ date: '', time: '' }), null, 'empty per-product schedule must inherit the batch schedule');
const customItem = { file: { name: 'foto-khusus.jpg' }, date: '2030-02-14', time: '13:45' };
assert.equal(apLocalCustomSchedule(customItem), new Date('2030-02-14T13:45:00').toISOString(), 'individual date/time should be stored as UTC from device local time');
assert.throws(() => apLocalCustomSchedule({ file: { name: 'foto.jpg' }, date: '2030-02-14', time: '' }), /harus diisi berpasangan/);
assert.throws(() => apLocalCustomSchedule({ file: { name: 'foto.jpg' }, date: '2020-01-01', time: '09:00' }), /masa depan/);

console.log('Auto Pilot schedule smoke tests passed: 100-photo batch, per-slot grouping, selected weekdays, queue continuation, individual date/time overrides, and invalid inputs.');
