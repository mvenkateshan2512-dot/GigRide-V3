const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadCore() {
  const store = new Map();
  const window = {
    localStorage: {
      getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => store.set(k, String(v))
    },
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' }
  };
  const context = vm.createContext({ window, console, Date, Math, JSON, Number, String, RegExp, Set, Error });
  vm.runInContext(fs.readFileSync('src/gigride-cfo-core.js', 'utf8'), context);
  return window.GigRideCfoCore;
}

test('voice shift commands are recognized', () => {
  const core = loadCore();
  assert.equal(core.parseVoiceCommand('Start shift').intent, 'start_shift');
  assert.equal(core.parseVoiceCommand('Stop shift').intent, 'stop_shift');
});

test('Ola income becomes paise-based income', () => {
  const core = loadCore();
  const parsed = core.parseVoiceCommand('Ola 350');
  assert.equal(parsed.type, 'income');
  assert.equal(parsed.category, 'trip_income');
  assert.equal(parsed.amountMinor, 35000);
  assert.equal(parsed.platform, 'ola');
});

test('fuel expense is parsed safely', () => {
  const core = loadCore();
  const parsed = core.parseVoiceCommand('Petrol 500');
  assert.equal(parsed.type, 'expense');
  assert.equal(parsed.category, 'fuel');
  assert.equal(parsed.amountMinor, 50000);
});

test('missing amount is never silently committed', () => {
  const core = loadCore();
  const parsed = core.parseVoiceCommand('Petrol');
  assert.equal(parsed.requiresConfirmation, true);
  assert.equal(parsed.reason, 'missing_amount');
});

test('transaction is queued once and duplicate id is rejected', () => {
  const core = loadCore();
  const parsed = core.parseVoiceCommand('Toll 80');
  const tx = core.createTransaction(parsed, { captureMethod: 'voice', shiftId: 'shift-test' });
  assert.equal(core.commitTransaction(tx).saved, true);
  assert.equal(core.commitTransaction(tx).duplicate, true);
  assert.equal(core.getPendingSync().length, 1);
  assert.equal(core.getPendingSync()[0].amountMinor, 8000);
});

test('CFO acknowledgement removes accepted transaction from pending queue', () => {
  const core = loadCore();
  const tx = core.createTransaction(core.parseVoiceCommand('Uber 420'), {});
  core.commitTransaction(tx);
  assert.equal(core.acknowledge(tx.transactionId, 'accepted'), true);
  assert.equal(core.getPendingSync().length, 0);
});
