(function (global) {
  'use strict';

  const STORAGE_KEY = 'gigride.cfo.transactions.v1';
  const QUEUE_KEY = 'gigride.cfo.syncQueue.v1';

  const CATEGORY_ALIASES = {
    petrol: 'fuel', fuel: 'fuel', diesel: 'fuel',
    toll: 'toll', parking: 'parking', maintenance: 'maintenance', repair: 'maintenance',
    food: 'food', incentive: 'incentive', bonus: 'incentive', tip: 'tip',
    ola: 'trip_income', uber: 'trip_income', rapido: 'trip_income'
  };

  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return 'gr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function readJson(key) {
    try { return JSON.parse(global.localStorage.getItem(key) || '[]'); } catch (_) { return []; }
  }

  function writeJson(key, value) {
    global.localStorage.setItem(key, JSON.stringify(value));
  }

  function parseAmount(text) {
    const match = String(text).match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)/i);
    if (!match) return null;
    const rupees = Number(match[1]);
    if (!Number.isFinite(rupees) || rupees <= 0) return null;
    return Math.round(rupees * 100);
  }

  function parseVoiceCommand(raw) {
    const text = String(raw || '').trim().toLowerCase();
    if (!text) return { intent: 'unknown', requiresConfirmation: true, reason: 'empty_command' };
    if (/^(start|begin)\s+(my\s+)?shift$/.test(text)) return { intent: 'start_shift', requiresConfirmation: false };
    if (/^(stop|end|finish)\s+(my\s+)?shift$/.test(text)) return { intent: 'stop_shift', requiresConfirmation: true };
    if (/^undo(\s+last(\s+transaction)?)?$/.test(text)) return { intent: 'undo_last', requiresConfirmation: true };
    if (/today'?s?\s+earnings|earnings\s+today/.test(text)) return { intent: 'query_today_income', requiresConfirmation: false };
    if (/today'?s?\s+expenses|expenses\s+today/.test(text)) return { intent: 'query_today_expense', requiresConfirmation: false };
    if (/net\s+(profit|income)/.test(text)) return { intent: 'query_net_profit', requiresConfirmation: false };
    if (/\bdistance\b/.test(text)) return { intent: 'query_distance', requiresConfirmation: false };
    if (/fuel\s+status/.test(text)) return { intent: 'query_fuel', requiresConfirmation: false };

    const amountMinor = parseAmount(text);
    const alias = Object.keys(CATEGORY_ALIASES).find(k => new RegExp('\\b' + k + '\\b', 'i').test(text));
    if (!amountMinor || !alias) {
      return { intent: 'transaction', requiresConfirmation: true, reason: !amountMinor ? 'missing_amount' : 'missing_category', raw };
    }
    const category = CATEGORY_ALIASES[alias];
    const explicitExpense = /expense|spent|paid|cost/.test(text);
    const explicitIncome = /income|earned|earning|received/.test(text);
    const type = category === 'trip_income' || category === 'incentive' || category === 'tip' ? 'income' : 'expense';
    if ((explicitExpense && type === 'income') || (explicitIncome && type === 'expense')) {
      return { intent: 'transaction', requiresConfirmation: true, reason: 'type_conflict', raw };
    }
    return { intent: 'transaction', requiresConfirmation: false, type, category, amountMinor, platform: ['ola','uber','rapido'].includes(alias) ? alias : null, raw };
  }

  function createTransaction(parsed, options) {
    if (!parsed || parsed.intent !== 'transaction' || parsed.requiresConfirmation) throw new Error('Transaction is not safe to commit');
    const now = new Date().toISOString();
    return {
      transactionId: uuid(), schemaVersion: 1, capturedAt: now, sourceApp: 'gigride',
      captureMethod: (options && options.captureMethod) || 'voice', type: parsed.type,
      category: parsed.category, amountMinor: parsed.amountMinor, currency: 'INR',
      platform: parsed.platform || null, note: (options && options.note) || null,
      shiftId: (options && options.shiftId) || null, syncStatus: 'pending', revision: 1
    };
  }

  function commitTransaction(tx) {
    const transactions = readJson(STORAGE_KEY);
    if (transactions.some(item => item.transactionId === tx.transactionId)) return { saved: false, duplicate: true, transaction: tx };
    transactions.push(tx);
    writeJson(STORAGE_KEY, transactions);
    const queue = readJson(QUEUE_KEY);
    if (!queue.includes(tx.transactionId)) queue.push(tx.transactionId);
    writeJson(QUEUE_KEY, queue);
    return { saved: true, duplicate: false, transaction: tx };
  }

  function getPendingSync() {
    const ids = new Set(readJson(QUEUE_KEY));
    return readJson(STORAGE_KEY).filter(tx => ids.has(tx.transactionId) && tx.syncStatus === 'pending');
  }

  function acknowledge(transactionId, status) {
    if (!['sent','accepted','rejected','needs_review'].includes(status)) throw new Error('Invalid sync status');
    const transactions = readJson(STORAGE_KEY);
    const tx = transactions.find(item => item.transactionId === transactionId);
    if (!tx) return false;
    tx.syncStatus = status;
    writeJson(STORAGE_KEY, transactions);
    if (status === 'accepted' || status === 'rejected') {
      writeJson(QUEUE_KEY, readJson(QUEUE_KEY).filter(id => id !== transactionId));
    }
    return true;
  }

  global.GigRideCfoCore = { parseVoiceCommand, createTransaction, commitTransaction, getPendingSync, acknowledge };
})(window);
