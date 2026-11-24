/* Lưu tiến độ ngay trên máy (localStorage). Không cần tài khoản. */
(function (root) {
  'use strict';
  // Đổi KEY mỗi khi sinh lại bộ màn: tiến độ cũ thuộc màn khác, giữ lại sẽ hiện sai.
  var KEY = 'anmang-v8';
  try { ['anmang-v1', 'anmang-v2', 'anmang-v3', 'anmang-v4', 'anmang-v5'].forEach(function (k) { root.localStorage.removeItem(k); }); } catch (e) { }
  var mem = { solved: {}, state: {}, last: null };

  function load() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        mem.solved = d.solved || {};
        mem.state = d.state || {};
        mem.last = d.last || null;
      }
    } catch (e) { /* chế độ duyệt riêng tư: chỉ lưu trong phiên */ }
  }
  function save() {
    try { root.localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { }
  }
  load();

  root.Store = {
    isSolved: function (id) { return !!mem.solved[id]; },
    solvedInfo: function (id) { return mem.solved[id] || null; },
    setSolved: function (id, info) { mem.solved[id] = info || { at: Date.now() }; delete mem.state[id]; save(); },
    getState: function (id) { return mem.state[id] || null; },
    setState: function (id, st) { mem.state[id] = st; mem.last = id; save(); },
    clearState: function (id) { delete mem.state[id]; save(); },
    countSolved: function (ids) {
      var c = 0;
      for (var i = 0; i < ids.length; i++) if (mem.solved[ids[i]]) c++;
      return c;
    },
    last: function () { return mem.last; },
    resetAll: function () { mem = { solved: {}, state: {}, last: null }; save(); }
  };
}(this));
