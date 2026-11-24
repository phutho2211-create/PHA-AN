/* Giao diện: trang chủ → danh sách vụ án → màn chơi. Điều hướng bằng #hash. */
(function () {
  'use strict';
  var D = window.PUZZLES, Core = window.Core, Clues = window.Clues, Store = window.Store;
  var app = document.getElementById('app');
  var modalEl = document.getElementById('modal');
  var toastEl = document.getElementById('toast');
  var esc = Clues.esc;

  var cur = null;   // màn đang chơi: { puz, st, sel, hist, solved }
  var toastTimer = null;

  function levelOf(key) {
    for (var i = 0; i < D.levels.length; i++) if (D.levels[i].key === key) return D.levels[i];
    return null;
  }
  function numberOf(puz) { return levelOf(puz.level).ids.indexOf(puz.id) + 1; }

  function toast(msg, ms) {
    toastEl.innerHTML = msg;
    toastEl.hidden = false;
    toastEl.className = 'toast show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; toastEl.hidden = true; }, ms || 2600);
  }

  function showModal(html) {
    modalEl.innerHTML = '<div class="sheet">' + html + '</div>';
    modalEl.hidden = false;
  }
  function closeModal() { modalEl.hidden = true; modalEl.innerHTML = ''; }

  function token(puz, p, extra) {
    var person = puz.people[p];
    return '<span class="tok pc' + (person.victim ? 'v' : p) + (extra || '') + '">' + esc(person.initial) + '</span>';
  }

  // ---------- Trang chủ ----------
  function showHome() {
    cur = null;
    var html = '<section class="home">' +
      '<div class="logo">' + logoSvg() + '</div>' +
      '<h1>Án Mạng Ô Vuông</h1>' +
      '<p class="sub">Đọc lời khai, xếp chỗ từng người trong ngôi nhà và tìm ra hung thủ.</p>';
    var last = Store.last();
    if (last && D.puzzles[last] && Store.getState(last) && !Store.isSolved(last)) {
      var lp = D.puzzles[last];
      html += '<a class="btn primary wide" href="#p/' + last + '">Chơi tiếp: vụ số ' + numberOf(lp) + ' (' + levelOf(lp.level).name + ')</a>';
    }
    html += '<div class="levels">';
    D.levels.forEach(function (lv) {
      var done = Store.countSolved(lv.ids);
      html += '<a class="lv" href="#lv/' + lv.key + '">' +
        '<span class="lvname">' + esc(lv.name) + '</span>' +
        '<span class="lvmeta">Lưới ' + lv.n + '×' + lv.n + ' · ' + lv.n + ' người</span>' +
        '<span class="lvprog"><i style="width:' + Math.round(done * 100 / lv.ids.length) + '%"></i></span>' +
        '<span class="lvcount">' + done + '/' + lv.ids.length + ' vụ đã phá</span></a>';
    });
    html += '</div><button class="btn ghost wide" data-act="rules">Cách chơi</button></section>';
    app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function logoSvg() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="4" width="56" height="56" rx="8" class="lg-bg"/>' +
      '<path d="M4 25h35M25 4v35M39 25v35M25 39h35" class="lg-wall"/>' +
      '<circle cx="47" cy="47" r="7" class="lg-dot"/><circle cx="15" cy="15" r="5" class="lg-dot2"/></svg>';
  }

  // ---------- Danh sách vụ án ----------
  function showLevel(key) {
    cur = null;
    var lv = levelOf(key);
    if (!lv) { location.hash = ''; return; }
    var html = '<header class="bar"><a class="back" href="#">‹ Trang chủ</a><div class="ttl">' + esc(lv.name) +
      ' <small>' + lv.n + '×' + lv.n + '</small></div><span class="bar-sp"></span></header>' +
      '<section class="list"><p class="hint">Chọn một vụ án. Ô có dấu ✓ là vụ đã phá.</p><div class="tiles">';
    lv.ids.forEach(function (id, i) {
      var cls = Store.isSolved(id) ? ' solved' : (Store.getState(id) ? ' going' : '');
      html += '<a class="tile' + cls + '" href="#p/' + id + '"><span>' + (i + 1) + '</span></a>';
    });
    html += '</div></section>';
    app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  // ---------- Màn chơi ----------
  function emptyState(puz) {
    var st = { place: [], marks: [], notes: [], struck: [], hints: 0, elapsed: 0 };
    for (var p = 0; p < puz.people.length; p++) st.place[p] = -1;
    return st;
  }

  function showPlay(id) {
    var puz = D.puzzles[id];
    if (!puz) { location.hash = ''; return; }
    var solved = Store.isSolved(id);
    var st = solved ? null : Store.getState(id);
    if (!st) st = emptyState(puz);
    if (solved) st.place = puz.solution.slice();
    if (!st.notes) st.notes = [];   // tiến độ lưu từ bản cũ chưa có ghi chú
    cur = { puz: puz, st: st, sel: 0, mode: 'place', hist: [], solved: solved, tick: Date.now() };
    renderPlay();
    window.scrollTo(0, 0);
  }

  function touchTime() {
    var now = Date.now(), d = now - cur.tick;
    cur.tick = now;
    if (d > 0 && d < 5 * 60000) cur.st.elapsed += d;   // bỏ qua khoảng nghỉ dài
  }

  function persist() {
    if (cur.solved) return;
    touchTime();
    Store.setState(cur.puz.id, cur.st);
  }

  function snapshot() {
    cur.hist.push(JSON.stringify({ place: cur.st.place, marks: cur.st.marks, notes: cur.st.notes }));
    if (cur.hist.length > 300) cur.hist.shift();
  }

  function whoAt(c) { return cur.st.place.indexOf(c); }

  // Người bị trùng hàng/cột với người khác.
  function conflicts() {
    var puz = cur.puz, bad = {}, place = cur.st.place;
    for (var a = 0; a < place.length; a++) for (var b = a + 1; b < place.length; b++) {
      if (place[a] < 0 || place[b] < 0) continue;
      if (Core.rowOf(puz, place[a]) === Core.rowOf(puz, place[b]) || Core.colOf(puz, place[a]) === Core.colOf(puz, place[b])) {
        bad[a] = bad[b] = true;
      }
    }
    return bad;
  }

  // Thùng rác: xóa hết các bước đã đi (có hộp thoại xác nhận).
  var CLEAR_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var UNDO_ICO ='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7H4V2M4.5 7A8.5 8.5 0 1 1 3.6 13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // Bố cục một màn hình: thanh trên · lưới · công cụ · dải nhân vật (trượt ngang) · lời khai · nút nộp.
  function renderPlay() {
    var puz = cur.puz, lv = levelOf(puz.level);
    var html = '<div class="play n' + puz.n + '" style="--n:' + puz.n + '">' +
      '<header class="bar pbar"><a class="back" href="#lv/' + puz.level + '">‹ ' + esc(lv.name) + '</a>' +
      '<button class="iconbtn q" data-act="rules" aria-label="Cách chơi">?</button>' +
      '<div class="ttl">Vụ số ' + numberOf(puz) + ' <span class="timer" id="timer">' + fmtClock(elapsedNow()) + '</span></div>' +
      (cur.solved ? '<span class="iconbtn"></span>'
        : '<button class="iconbtn" data-act="undo" aria-label="Hoàn tác">' + UNDO_ICO + '</button>' +
          '<button class="iconbtn" data-act="clear" aria-label="Xóa hết, chơi lại từ đầu">' + CLEAR_ICO + '</button>') +
      '</header>' +
      '<div class="stage"><div class="board" id="board"></div></div>' +
      '<div class="side">' +
      (cur.solved ? '<div class="solvedbar">Đã phá án. Hung thủ: ' + Clues.who(puz, puz.murderer) +
        '<button class="btn small" data-act="replay">Chơi lại</button></div>'
        : '<div class="modes" id="modes"></div>') +
      '<div class="strip" id="strip"></div>' +
      '<div class="cbox" id="cbox"></div>' +
      (cur.solved ? '' : '<button class="btn primary submit" data-act="check">Nộp lời giải</button>') +
      '</div></div>';
    app.className = 'is-play';
    app.innerHTML = html;
    renderBoard();
    renderTools();
    fitBoard();
  }

  // Lưới chiếm hết chỗ còn trống sau khi đã xếp các phần khác, để cả màn chơi nằm gọn trong một màn hình.
  function fitBoard() {
    var play = app.querySelector('.play');
    if (!play) return;
    var bs = getComputedStyle(document.body);
    var h = window.innerHeight - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom);
    play.classList.remove('tall');
    play.style.setProperty('--app-h', h + 'px');
    var stage = play.querySelector('.stage');
    // Lưới rộng gần sát hai mép màn hình (chừa 4px mỗi bên); chỉ thu nhỏ khi thiếu chiều cao.
    var bw = Math.floor(Math.min(stage.clientWidth - 8, stage.clientHeight - 4, 760));
    // Máy quá thấp (iPhone SE có thanh Safari): giữ mỗi ô tối thiểu ~34px để bấm trúng, chấp nhận cuộn trang.
    var min = Math.min(stage.clientWidth - 8, Math.max(220, cur.puz.n * 34 + 6));
    if (bw < min) { bw = min; play.classList.add('tall'); }
    play.style.setProperty('--bw', bw + 'px');
  }
  var fitTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(function () { fitClues(); fitBoard(); }, 60);
  });

  function elapsedNow() {
    if (!cur) return 0;
    if (cur.solved) { var inf = Store.solvedInfo(cur.puz.id); return inf && inf.time || 0; }
    var d = Date.now() - cur.tick;
    return cur.st.elapsed + (d > 0 && d < 5 * 60000 ? d : 0);
  }
  function fmtClock(ms) {
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    function two(x) { return (x < 10 ? '0' : '') + x; }
    return (h ? h + ':' + two(m % 60) : two(m)) + ':' + two(s % 60);
  }
  setInterval(function () {
    if (!cur || cur.solved || document.hidden) return;
    var el = document.getElementById('timer');
    if (el) el.textContent = fmtClock(elapsedNow());
  }, 1000);

  // Lớp phủ SVG: đường lưới mảnh + tường phòng đậm. Vẽ một lần cho mỗi màn.
  // Dùng SVG thay cho box-shadow để nét tường liền mạch, đều nhau và không bị lớp khác che.
  function boardOverlay(puz) {
    if (puz._overlay) return puz._overlay;
    var n = puz.n, grid = '', wall = '', c, r, k;
    for (var i = 1; i < n; i++) grid += 'M' + i + ' 0V' + n + 'M0 ' + i + 'H' + n;
    for (c = 0; c < n * n; c++) {
      r = Math.floor(c / n); k = c % n;
      if (k < n - 1 && puz.rooms[c + 1] !== puz.rooms[c]) wall += 'M' + (k + 1) + ' ' + r + 'V' + (r + 1);
      if (r < n - 1 && puz.rooms[c + n] !== puz.rooms[c]) wall += 'M' + k + ' ' + (r + 1) + 'H' + (k + 1);
    }
    var svg = '<svg class="lines" viewBox="0 0 ' + n + ' ' + n + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="gl" d="' + grid + '"/><path class="wl" d="' + wall + '"/></svg>';
    // Nhãn phòng: đặt ở đoạn ngang dài nhất của phòng (bằng nhau thì lấy đoạn cao nhất) để đỡ bị cắt chữ.
    var best = {};
    for (r = 0; r < n; r++) {
      for (k = 0; k < n;) {
        var room = puz.rooms[r * n + k], len = 1;
        while (k + len < n && puz.rooms[r * n + k + len] === room) len++;
        if (!best[room] || len > best[room].len) best[room] = { r: r, k: k, len: len };
        k += len;
      }
    }
    var labs = '<div class="rlabs" aria-hidden="true">';
    Object.keys(best).forEach(function (room) {
      var b = best[room];
      labs += '<span class="rlab" style="--h:' + Clues.roomHue(puz, +room) + ';left:' + (b.k * 100 / n) + '%;top:' + (b.r * 100 / n) +
        '%;max-width:calc(var(--cell) * ' + b.len + ' - 6px)">' + esc(puz.roomNames[room]) + '</span>';
    });
    labs += '</div>';
    puz._overlay = svg + labs;
    return puz._overlay;
  }

  function renderBoard() {
    var puz = cur.puz, n = puz.n, N = puz.people.length, html = '', bad = conflicts();
    var takenR = {}, takenC = {}, placedMask = 0;
    cur.st.place.forEach(function (c, q) {
      if (c >= 0) { takenR[Core.rowOf(puz, c)] = true; takenC[Core.colOf(puz, c)] = true; placedMask |= 1 << q; }
    });

    for (var c = 0; c < n * n; c++) {
      var r = Math.floor(c / n), k = c % n, room = puz.rooms[c];
      var o = puz.objects[c], p = whoAt(c), blk = o && !Core.OBJECTS[o].walk;
      var cls = 'cell fl-' + Clues.floor(puz.roomNames[room]);
      if (blk) cls += ' blk';
      if (p >= 0) cls += ' has-p';
      if (cur.flash === c) cls += ' flash';
      html += '<div class="' + cls + '" data-c="' + c + '" style="--h:' + Clues.roomHue(puz, room) + '">';
      if (o) html += Clues.icon(o);
      if (p >= 0) html += token(puz, p, (bad[p] ? ' bad' : '') + (cur.hintCell === c ? ' hinted' : ''));
      else if (!blk) {
        // Ghi chú chỉ hiện khi còn ý nghĩa: ô chưa bị ✕, và bỏ chữ của người đã đặt lên lưới.
        var crossed = cur.st.marks[c] || takenR[r] || takenC[k];
        var nb = crossed ? 0 : (cur.st.notes[c] || 0) & ~placedMask;
        if (nb) {
          html += '<span class="notes">';
          for (var q = 0; q < N; q++) {
            html += '<i class="pc' + (puz.people[q].victim ? 'v' : q) + '">' + (nb >> q & 1 ? esc(puz.people[q].initial) : '') + '</i>';
          }
          html += '</span>';
        }
        // ✕ tự động: ô cùng hàng/cột với người đã đặt (nhạt hơn ✕ do người chơi tự đánh).
        if (cur.st.marks[c]) html += Clues.cross(false);
        else if (takenR[r] || takenC[k]) html += Clues.cross(true);
      }
      html += '</div>';
    }
    document.getElementById('board').innerHTML = html + boardOverlay(puz);
  }

  var MODES = [
    { key: 'place', name: 'Đặt người', help: 'Chọn một người rồi chạm vào ô để đặt. Chạm lại ô đó để nhấc ra.',
      ico: '<circle cx="12" cy="12" r="7.5" fill="currentColor"/>' },
    { key: 'note', name: 'Ghi chú', help: 'Chọn một người rồi chạm ô để ghi "có thể ở đây". Chạm lại để bỏ ghi chú.',
      ico: '<path d="M4.5 19.5l1.2-4.4L15.8 5a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.9 18.3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' },
    { key: 'x', name: 'Dấu ✕', help: 'Chạm ô để đánh dấu chắc chắn không có ai. Ô cùng hàng, cột với người đã đặt tự hiện ✕ nhạt.',
      ico: '<path d="M6 6l12 12M18 6L6 18" stroke="#d62828" stroke-width="3" stroke-linecap="round"/>' },
    { key: 'erase', name: 'Tẩy', help: 'Chạm ô để xóa người, ghi chú và dấu ✕ trong ô đó.',
      ico: '<path d="M9 19h10M4.6 14.6l8.5-8.5a1.5 1.5 0 0 1 2.1 0l3.3 3.3a1.5 1.5 0 0 1 0 2.1L12 18.1a3 3 0 0 1-2.1.9H8.4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' }
  ];

  var HINT_ICO = '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';

  // Hàng công cụ, dải nhân vật và khung lời khai đều đổi theo người đang chọn nên vẽ lại cùng nhau.
  function renderTools() {
    var puz = cur.puz, el = document.getElementById('modes'), html = '';
    if (el) {
      MODES.forEach(function (m) {
        html += '<button class="mode' + (cur.mode === m.key ? ' on' : '') + '" data-mode="' + m.key + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' + m.ico + '</svg><span>' + m.name + '</span></button>';
      });
      html += '<button class="mode" data-act="hint"><svg viewBox="0 0 24 24" aria-hidden="true">' + HINT_ICO + '</svg><span>Gợi ý</span>' +
        (cur.st.hints ? '<i class="badge">' + cur.st.hints + '</i>' : '') + '</button>';
      el.innerHTML = html;
    }

    var strip = document.getElementById('strip'), keep = strip.scrollLeft;
    html = '';
    puz.people.forEach(function (person, p) {
      var placed = cur.st.place[p] >= 0;
      html += '<button class="pp pc' + (person.victim ? 'v' : p) + (cur.sel === p ? ' on' : '') + (placed ? ' placed' : '') + '" data-sel="' + p + '">' +
        '<span class="av">' + esc(person.initial) + (placed ? '<i class="ok">✓</i>' : '') + '</span>' +
        '<span class="tname">' + esc(person.name) + '</span></button>';
    });
    strip.className = 'strip m-' + (cur.solved ? 'done' : cur.mode);
    strip.innerHTML = html;
    // Giữ nguyên vị trí đã trượt; chỉ trượt thêm khi người đang chọn bị khuất.
    strip.scrollLeft = keep;
    var b = strip.children[cur.sel];
    if (b) {
      if (b.offsetLeft < strip.scrollLeft) strip.scrollLeft = b.offsetLeft - 10;
      else if (b.offsetLeft + b.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = b.offsetLeft + b.offsetWidth - strip.clientWidth + 10;
    }
    renderClues();
  }

  // Khung lời khai chỉ hiện của người đang chọn. Mọi khung xếp chồng lên nhau trong cùng một ô lưới,
  // nên khung luôn cao bằng khung dài nhất: đổi người thì lưới phía trên không bị nhảy.
  // Mỗi người tối đa 2 manh mối, mỗi manh mối một dòng, tên chỉ nhắc ở dòng đầu:
  // "Nam ở trong Nhà bếp," / "và ngồi trên ghế." Mỗi dòng vẫn chạm để gạch riêng.
  function renderClues() {
    var puz = cur.puz, html = '';
    puz.people.forEach(function (person, p) {
      var list = [];
      puz.clues.forEach(function (cl, i) { if (cl.p === p) list.push(i); });
      html += '<div class="cp' + (cur.sel === p ? ' on' : '') + '">';
      if (person.victim) {
        html += '<div class="vnote">' + Clues.who(puz, p) + ' là nạn nhân,</div><div class="vnote">ở một mình cùng hung thủ.</div>';
      } else if (!list.length) {
        html += '<div class="noclue">' + Clues.who(puz, p) + ' không có lời khai.</div>';
      }
      list.forEach(function (i, k) {
        var last = k === list.length - 1;
        html += '<div class="clue' + (cur.st.struck[i] ? ' struck' : '') + '" data-ci="' + i + '">' +
          (k ? 'và ' : Clues.who(puz, p) + ' ') + Clues.part(puz, puz.clues[i]) + (last ? '.' : ',') + '</div>';
      });
      html += '</div>';
    });
    var box = document.getElementById('cbox');
    box.innerHTML = html;
    fitClues(box);
  }

  // Co chữ để dòng dài nhất của cả màn vừa một dòng; cùng một cỡ cho mọi người nên đổi người không nhảy chữ.
  function fitClues(box) {
    box = box || document.getElementById('cbox');
    if (!box) return;
    var base = 16, min = 12;
    box.style.fontSize = base + 'px';
    var ratio = 1;
    box.querySelectorAll('.clue, .vnote, .noclue').forEach(function (el) {
      var cs = getComputedStyle(el), pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      if (el.clientWidth > pad) ratio = Math.max(ratio, (el.scrollWidth - pad) / (el.clientWidth - pad));
    });
    if (ratio > 1) box.style.fontSize = Math.max(min, Math.floor(base / ratio * 2) / 2) + 'px';
  }

  function tapCell(c) {
    if (cur.solved) return;
    var puz = cur.puz, sel = cur.sel, mode = cur.mode, p = whoAt(c), o = puz.objects[c], st = cur.st;
    cur.hintCell = -1;
    if (o && !Core.OBJECTS[o].walk) {
      if (mode !== 'erase') toast('Không ai đứng được ở ô có ' + Core.OBJECTS[o].name + '.');
      return;
    }
    if (mode === 'x') {
      if (p >= 0) { toast('Ô này đang có người. Dùng Tẩy để nhấc ra.'); return; }
      snapshot();
      st.marks[c] = st.marks[c] ? 0 : 1;
    } else if (mode === 'note') {
      if (p >= 0) { toast('Ô này đã có người. Dùng Tẩy để nhấc ra.'); return; }
      if (st.place[sel] >= 0) { toast(puz.people[sel].name + ' đã được đặt lên lưới rồi.'); return; }
      var rc = Core.rowOf(puz, c), cc = Core.colOf(puz, c);
      var lined = st.place.some(function (q) { return q >= 0 && (Core.rowOf(puz, q) === rc || Core.colOf(puz, q) === cc); });
      if (st.marks[c] || lined) { toast('Ô này đã bị loại (dấu ✕), không cần ghi chú.'); return; }
      snapshot();
      st.notes[c] = (st.notes[c] || 0) ^ (1 << sel);
    } else if (mode === 'erase') {
      if (p < 0 && !st.marks[c] && !st.notes[c]) return;
      snapshot();
      if (p >= 0) st.place[p] = -1;
      st.marks[c] = 0;
      st.notes[c] = 0;
    } else {
      snapshot();
      if (p === sel) cur.st.place[sel] = -1;
      else {
        if (p >= 0) cur.st.place[p] = -1;
        cur.st.place[sel] = c;
        cur.st.marks[c] = 0;
      }
    }
    persist();
    renderBoard();
    renderTools();
  }

  function act(name) {
    if (name === 'rules') return showRules();
    if (name === 'close') return closeModal();
    if (!cur) return;
    var puz = cur.puz;
    if (name === 'undo') {
      if (!cur.hist.length) { toast('Không còn gì để hoàn tác.'); return; }
      var h = JSON.parse(cur.hist.pop());
      cur.st.place = h.place; cur.st.marks = h.marks; cur.st.notes = h.notes || [];
      persist(); renderBoard(); renderTools();
    } else if (name === 'clear') {
      showModal('<h2>Xóa hết, đi lại từ đầu?</h2><p>Mọi người sẽ được nhấc khỏi lưới, các ghi chú, dấu ✕ và gạch lời khai cũng bị xóa. Đồng hồ vẫn chạy tiếp.</p>' +
        '<div class="mbtns"><button class="btn" data-act="close">Thôi</button><button class="btn danger" data-act="clear-yes">Xóa hết</button></div>');
    } else if (name === 'clear-yes') {
      closeModal();
      snapshot();
      var keep = cur.st;
      cur.st = emptyState(puz);
      cur.st.hints = keep.hints; cur.st.elapsed = keep.elapsed;
      persist(); renderPlay();
    } else if (name === 'hint') {
      hint();
    } else if (name === 'check') {
      check();
    } else if (name === 'replay') {
      cur.solved = false;
      cur.st = emptyState(puz);
      cur.sel = 0; cur.mode = 'place'; cur.hist = []; cur.tick = Date.now();
      renderPlay();
    } else if (name === 'next') {
      closeModal(); closeWin();
      var lv = levelOf(puz.level), i = lv.ids.indexOf(puz.id);
      location.hash = i + 1 < lv.ids.length ? '#p/' + lv.ids[i + 1] : '#lv/' + lv.key;
    } else if (name === 'tolist') {
      closeModal(); closeWin();
      location.hash = '#lv/' + puz.level;
    } else if (name === 'review') {
      closeWin();
    } else if (name.indexOf('accuse-') === 0) {
      accuse(parseInt(name.slice(7), 10));
    }
  }

  function hint() {
    var puz = cur.puz, place = cur.st.place;
    for (var p = 0; p < place.length; p++) {
      if (place[p] >= 0 && place[p] !== puz.solution[p]) {
        cur.hintCell = place[p];
        cur.st.hints++;
        persist(); renderBoard(); renderTools();
        toast('Vị trí của ' + esc(puz.people[p].name) + ' chưa đúng.');
        return;
      }
    }
    // Gợi ý người suy ra được sớm nhất từ những người đã đặt đúng, bằng kỹ thuật của cấp này.
    var ls = Core.logicSolve(puz, Core.logicLevel(puz), place), best = -1, bestAt = 1e9;
    for (p = 0; p < place.length; p++) {
      if (place[p] >= 0) continue;
      var at = ls.fixedAt[p] == null ? 1e6 : ls.fixedAt[p];
      if (at < bestAt) { bestAt = at; best = p; }
    }
    if (best < 0) { toast('Mọi người đều đúng chỗ. Bấm Kiểm tra!'); return; }
    snapshot();
    var cell = puz.solution[best], other = whoAt(cell);
    if (other >= 0) place[other] = -1;
    place[best] = cell;
    cur.st.marks[cell] = 0;
    cur.st.hints++;
    cur.hintCell = cell;
    persist(); renderBoard(); renderTools();
    toast('Đã đặt ' + esc(puz.people[best].name) + ' vào đúng chỗ.');
  }

  function check() {
    var puz = cur.puz, place = cur.st.place, missing = 0, p;
    for (p = 0; p < place.length; p++) if (place[p] < 0) missing++;
    if (missing) { toast('Còn ' + missing + ' người chưa xếp chỗ.'); return; }
    var bad = conflicts();
    if (Object.keys(bad).length) { toast('Có người đứng trùng hàng hoặc trùng cột (vòng đỏ).'); return; }
    var wrong = 0;
    for (p = 0; p < place.length; p++) if (place[p] !== puz.solution[p]) wrong++;
    if (wrong) { toast('Chưa đúng: ' + wrong + ' người đặt sai chỗ. Đọc lại lời khai nhé.', 3200); return; }
    var V = puz.people.length - 1, html = '<h2>Ai là hung thủ?</h2><p>Mọi người đã đúng chỗ. Hãy chỉ ra kẻ đã ra tay với ' +
      Clues.who(puz, V) + '.</p><div class="accuse">';
    for (p = 0; p < V; p++) {
      html += '<button class="btn person" data-act="accuse-' + p + '">' + token(puz, p) + esc(puz.people[p].name) + '</button>';
    }
    html += '</div><div class="mbtns"><button class="btn ghost" data-act="close">Để tôi xem lại</button></div>';
    showModal(html);
  }

  function accuse(p) {
    var puz = cur.puz, V = puz.people.length - 1;
    if (p !== puz.murderer) {
      showModal('<h2>Chưa đúng</h2><p>' + Clues.who(puz, p) + ' không ở cùng phòng với nạn nhân. ' +
        'Hung thủ là người <b>ở một mình cùng</b> ' + Clues.who(puz, V) + ' trong một phòng.</p>' +
        '<div class="mbtns"><button class="btn primary" data-act="check">Chọn lại</button></div>');
      return;
    }
    touchTime();
    var info = { at: Date.now(), time: cur.st.elapsed, hints: cur.st.hints };
    Store.setSolved(puz.id, info);
    cur.solved = true;
    closeModal();
    var sub = app.querySelector('.submit'), r = sub ? sub.getBoundingClientRect() : null;
    var ox = r ? r.left + r.width / 2 : window.innerWidth / 2, oy = r ? r.top + r.height / 2 : window.innerHeight / 2;
    if (sub) sub.classList.add('sent');
    setTimeout(function () {
      renderPlay();
      showWin(info, ox, oy);
    }, REDUCED ? 0 : 220);
  }

  // ---------- Màn phá án ----------
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var winEl = null;

  function closeWin() {
    if (winEl) { winEl.parentNode.removeChild(winEl); winEl = null; }
  }

  // Trang toàn màn hình: nền xanh mở ra theo vòng tròn từ nút Nộp, con dấu đập xuống, pháo giấy bung ra,
  // rồi lần lượt hiện hung thủ, thời gian và nút đi tiếp.
  function showWin(info, ox, oy) {
    closeWin();
    var puz = cur.puz, V = puz.people.length - 1, k = puz.murderer, lv = levelOf(puz.level);
    var pc = 'pc' + k, room = puz.roomNames[puz.rooms[puz.solution[V]]];
    var lines = ['Tài lắm, thám tử!', 'Không kẻ gian nào thoát được bạn!', 'Suy luận thật sắc bén!', 'Thêm một vụ án được khép lại!'];
    var line = lines[numberOf(puz) % lines.length];
    winEl = document.createElement('div');
    winEl.className = 'winscr' + (REDUCED ? ' still' : '');
    winEl.innerHTML = '<div class="win-in">' +
      '<div class="stamp"><span>PHÁ ÁN!</span></div>' +
      '<p class="w1 wmsg">Bạn đã tìm ra hung thủ. ' + line + '</p>' +
      '<h2 class="w2 wcase">Vụ án số ' + numberOf(puz) + ' · ' + esc(lv.name) + '</h2>' +
      '<div class="w3 wcard wkiller"><small>Hung thủ là</small>' +
      '<span class="av big ' + pc + '">' + esc(puz.people[k].initial) + '</span>' +
      '<b class="kname ' + pc + '">' + esc(puz.people[k].name) + '</b>' +
      '<small>ở một mình cùng ' + esc(puz.people[V].name) + ' ' + Clues.prepName(room) + ' ' + esc(room) + '</small></div>' +
      '<div class="w4 wcard wtime"><small>Thời gian</small><b id="wclock">' + fmtClock(REDUCED ? info.time : 0) + '</b>' +
      '<small>' + (info.hints ? 'Dùng ' + info.hints + ' gợi ý' : 'Không dùng gợi ý') + '</small></div>' +
      '<div class="w5 wbtns"><button class="btn wgo" data-act="next">Vụ tiếp theo</button>' +
      '<div class="wrow"><button class="btn wsub" data-act="review">Xem lại bàn</button>' +
      '<button class="btn wsub" data-act="tolist">Danh sách</button></div></div></div>';
    document.body.appendChild(winEl);
    if (REDUCED || !winEl.animate) return;

    var R = Math.hypot(Math.max(ox, innerWidth - ox), Math.max(oy, innerHeight - oy)) + 20;
    winEl.animate([{ clipPath: 'circle(0px at ' + ox + 'px ' + oy + 'px)' }, { clipPath: 'circle(' + R + 'px at ' + ox + 'px ' + oy + 'px)' }],
      { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)' });
    var mine = winEl;
    setTimeout(function () { if (winEl === mine) confetti(mine); }, 760);
    setTimeout(function () { if (winEl === mine) countUp(mine.querySelector('#wclock'), info.time, 700); }, 1500);
  }

  function countUp(el, ms, dur) {
    var t0 = performance.now();
    (function step(t) {
      if (!el.isConnected) return;
      var x = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - x, 3);
      el.textContent = fmtClock(ms * e);
      if (x < 1) requestAnimationFrame(step);
    }(t0));
  }

  // Pháo giấy bắn ra từ con dấu rồi rơi xuống: mảnh chữ nhật, tròn và hình lá, xoay khi rơi.
  function confetti(scr) {
    var st = scr.querySelector('.stamp'), r = st.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var colors = ['#2e8b57', '#55b96f', '#f08a24', '#f6c445', '#e0473a', '#2f7fc1'];
    for (var i = 0; i < 70; i++) {
      var el = document.createElement('i'), shape = i % 3;
      el.className = 'cf cf' + shape;
      el.style.background = colors[i % colors.length];
      el.style.left = cx + 'px'; el.style.top = cy + 'px';
      scr.appendChild(el);
      var a = -Math.PI * (0.05 + Math.random() * 0.9), v = 90 + Math.random() * 190;
      var dx = Math.cos(a) * v * 1.4, dy = Math.sin(a) * v, fall = 320 + Math.random() * 360;
      var rot = (Math.random() < .5 ? -1 : 1) * (360 + Math.random() * 540), d = 1300 + Math.random() * 900;
      el.animate([
        { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg) scale(.4)', opacity: 1, easing: 'cubic-bezier(.15,.7,.3,1)' },
        { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) rotate(' + rot * .3 + 'deg) scale(1)', opacity: 1, offset: .28, easing: 'cubic-bezier(.4,0,.8,.6)' },
        { transform: 'translate(-50%,-50%) translate(' + dx * 1.35 + 'px,' + (dy + fall) + 'px) rotate(' + rot + 'deg) scale(.9)', opacity: 0 }
      ], { duration: d, fill: 'forwards' }).onfinish = (function (e) { return function () { if (e.parentNode) e.parentNode.removeChild(e); }; }(el));
    }
  }

  function showRules() {
    var O = Core.OBJECTS;
    function ob(k) { return '<span class="ob">' + Clues.icon(k) + O[k].name + '</span>'; }
    showModal('<h2>Cách chơi</h2>' +
      '<ol class="rules">' +
      '<li>Mỗi vụ án là một ngôi nhà chia thành nhiều <b>phòng</b> (màu khác nhau, viền đậm).</li>' +
      '<li>Mỗi <b>hàng</b> và mỗi <b>cột</b> có đúng <b>1 người</b>.</li>' +
      '<li>Mỗi khu vực có đồ vật riêng. Đồ ngồi, nằm hoặc đứng lên được, ví dụ: ' + ob('chair') + ob('sofa') + ob('bed') + ob('bathtub') + '</li>' +
      '<li>Ô bị <b>gạch chéo</b> là đồ không ai đứng được, ví dụ: ' + ob('table') + ob('fridge') + ob('tv') + ob('plant') + '</li>' +
      '<li><b>"Sát cạnh"</b> là ô ngay trên, dưới, trái hoặc phải <b>trong cùng phòng</b> (không tính đường chéo, không tính đồ vật bên kia tường).</li>' +
      '<li><b>"Phía trên"</b> nghĩa là ở hàng cao hơn, không cần thẳng cột. "Bên trái" cũng vậy.</li>' +
      '<li><b>Hung thủ</b> là người <b>ở một mình cùng nạn nhân</b> trong một phòng. Nạn nhân không có lời khai.</li>' +
      '</ol>' +
      '<h3>Thao tác</h3><ul class="rules">' +
      '<li><b>Đặt người:</b> chọn một người ở thanh dưới lưới, rồi chạm vào ô để đặt. Chạm lại ô đó để nhấc ra.</li>' +
      '<li><b>Ghi chú:</b> chọn một người rồi chạm các ô người đó <i>có thể</i> đứng. Chữ cái nhỏ hiện trong ô giúp bạn so sánh các phương án.</li>' +
      '<li><b>Dấu ✕:</b> đánh dấu ô chắc chắn không có ai. Ô cùng hàng, cùng cột với người đã đặt tự hiện ✕ nhạt.</li>' +
      '<li><b>Tẩy:</b> xóa người, ghi chú và dấu ✕ trong một ô.</li>' +
      '<li><b>Lời khai:</b> chọn một người ở dải nhân vật (vuốt ngang để xem hết) để đọc lời khai của người đó. Chạm vào lời khai để gạch đi khi đã dùng xong.</li>' +
      '<li><b>Hoàn tác</b> (mũi tên ở góc trên): lùi lại một bước. <b>Thùng rác</b>: xóa hết các bước để đi lại từ đầu.</li>' +
      '<li>Xếp xong mọi người thì bấm <b>Nộp lời giải</b> và chỉ ra hung thủ.</li>' +
      '</ul><div class="mbtns">' +
      '<button class="btn primary" data-act="close">Đã hiểu</button></div>');
  }

  // ---------- Sự kiện ----------
  function onTap(e) {
    var t = e.target;
    while (t && t !== document.body) {
      if (t.getAttribute) {
        var a = t.getAttribute('data-act');
        if (a) { e.preventDefault(); act(a); return; }
        var md = t.getAttribute('data-mode');
        if (md !== null && cur) {
          cur.mode = md; renderTools();
          // Không còn chỗ cho dòng hướng dẫn cố định, nên nhắc ngắn một lần khi đổi công cụ.
          MODES.forEach(function (m) { if (m.key === md) toast(m.help, 3000); });
          return;
        }
        var s = t.getAttribute('data-sel');
        if (s !== null && cur) {
          cur.sel = parseInt(s, 10);
          if (cur.mode === 'x' || cur.mode === 'erase') cur.mode = 'place';   // chọn người tức là muốn đặt
          renderTools();
          return;
        }
        var c = t.getAttribute('data-c');
        if (c !== null && cur) { tapCell(parseInt(c, 10)); return; }
        var ci = t.getAttribute('data-ci');
        if (ci !== null && cur && !cur.solved) {
          cur.st.struck[ci] = cur.st.struck[ci] ? 0 : 1;
          t.className = 'clue' + (cur.st.struck[ci] ? ' struck' : '');
          persist();
          return;
        }
      }
      if (t === modalEl) { if (e.target === modalEl) closeModal(); return; }
      t = t.parentNode;
    }
  }
  document.addEventListener('click', onTap);

  function route() {
    closeModal();
    closeWin();
    app.className = '';
    var h = location.hash.replace(/^#/, '');
    var m;
    if ((m = h.match(/^p\/(.+)$/))) showPlay(m[1]);
    else if ((m = h.match(/^lv\/(.+)$/))) showLevel(m[1]);
    else showHome();
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', function () {
    if (!cur) return;
    if (document.hidden) persist(); else cur.tick = Date.now();
  });
  route();

  // Chỉ bật chế độ offline khi chạy trên https (GitHub Pages); lúc xem thử trên máy thì tắt để luôn thấy bản mới nhất.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }
}());
