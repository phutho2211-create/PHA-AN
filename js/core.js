/*
 * Lõi luật chơi: dùng chung cho trình duyệt (window.Core) và Node (require).
 *
 * Định dạng một màn:
 *   n          kích thước lưới n×n, cũng là số người (n-1 nghi phạm + 1 nạn nhân)
 *   rooms      mảng n*n: chỉ số phòng của từng ô
 *   roomNames  tên phòng
 *   objects    mảng n*n: '' hoặc khóa trong OBJECTS
 *   people     [{name, initial}], người cuối cùng là nạn nhân
 *   clues      danh sách manh mối (xem UNARY / PAIR / 'alone')
 *   solution   ô của từng người
 *   murderer   chỉ số hung thủ
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Core = api;
}(this, function () {
  'use strict';

  // walk: đứng/ngồi lên được (on = câu lời khai khi ở trên món đó); không walk = ô gạch chéo.
  // max: số món cùng loại tối đa trong một phòng (mặc định 3 món đứng được, 2 món chặn; tools/generate.js cap()).
  // Tên phải khác nhau hẳn ("bàn ăn" / "bàn trà"...) để câu "ở sát cạnh ..." không mơ hồ.
  var OBJECTS = {
    chair:     { name: 'ghế', walk: true, on: 'ngồi trên ghế', max: 2 },
    rug:       { name: 'thảm', walk: true, on: 'đứng trên thảm', max: 2 },
    bed:       { name: 'giường', walk: true, on: 'nằm trên giường', max: 2 },
    sofa:      { name: 'sofa', walk: true, on: 'ngồi trên sofa', max: 2 },
    bathtub:   { name: 'bồn tắm', walk: true, on: 'ở trong bồn tắm', max: 1 },
    armchair:  { name: 'ghế bành', walk: true, on: 'ngồi trên ghế bành', max: 2 },
    stool:     { name: 'ghế đàn', walk: true, on: 'ngồi trên ghế đàn', max: 1 },
    swing:     { name: 'xích đu', walk: true, on: 'ngồi trên xích đu', max: 1 },
    bench:     { name: 'ghế đá', walk: true, on: 'ngồi trên ghế đá', max: 2 },
    motorbike: { name: 'xe máy', walk: true, on: 'ngồi trên xe máy', max: 2 },
    lounger:   { name: 'ghế tắm nắng', walk: true, on: 'nằm trên ghế tắm nắng', max: 2 },

    table:     { name: 'bàn ăn', walk: false },
    desk:      { name: 'bàn làm việc', walk: false },
    teatable:  { name: 'bàn trà', walk: false },
    vanity:    { name: 'bàn trang điểm', walk: false, max: 1 },
    plant:     { name: 'chậu cây', walk: false },
    tree:      { name: 'cây', walk: false },
    shelf:     { name: 'tủ sách', walk: false },
    cupboard:  { name: 'tủ bát', walk: false },
    wardrobe:  { name: 'tủ quần áo', walk: false },
    cabinet:   { name: 'tủ hồ sơ', walk: false },
    shoerack:  { name: 'tủ giày', walk: false },
    tv:        { name: 'tivi', walk: false, max: 1 },
    fridge:    { name: 'tủ lạnh', walk: false, max: 1 },
    sink:      { name: 'bồn rửa chén', walk: false, max: 1 },
    stove:     { name: 'bếp nấu', walk: false, max: 1 },
    washer:    { name: 'máy giặt', walk: false, max: 1 },
    basin:     { name: 'bồn rửa mặt', walk: false, max: 1 },
    toilet:    { name: 'bồn cầu', walk: false, max: 1 },
    piano:     { name: 'đàn piano', walk: false, max: 1 },
    clock:     { name: 'đồng hồ cây', walk: false, max: 1 },
    dryrack:   { name: 'giàn phơi', walk: false },
    well:      { name: 'giếng', walk: false, max: 1 },
    generator: { name: 'máy phát điện', walk: false, max: 1 },
    car:       { name: 'ô tô', walk: false, max: 1 },
    watertank: { name: 'bồn nước', walk: false, max: 1 },
    chest:     { name: 'rương', walk: false },
    crate:     { name: 'thùng gỗ', walk: false },
    rack:      { name: 'kệ đồ', walk: false },
    winerack:  { name: 'giá rượu', walk: false },
    barrel:    { name: 'thùng rượu', walk: false },
    toolbox:   { name: 'hộp đồ nghề', walk: false }
  };

  var UNARY = { inRoom: 1, notInRoom: 1, onObj: 1, noObj: 1, besideObj: 1 };
  var PAIR = { above: 1, left: 1, sameRoom: 1, diffRoom: 1 };

  function victimIndex(puz) { return puz.people.length - 1; }
  function rowOf(puz, c) { return Math.floor(c / puz.n); }
  function colOf(puz, c) { return c % puz.n; }
  function walkable(puz, c) { var o = puz.objects[c]; return !o || OBJECTS[o].walk; }

  function neighbors(n, c) {
    var r = Math.floor(c / n), k = c % n, out = [];
    if (r > 0) out.push(c - n);
    if (r < n - 1) out.push(c + n);
    if (k > 0) out.push(c - 1);
    if (k < n - 1) out.push(c + 1);
    return out;
  }

  // "Sát cạnh": ô kề trên/dưới/trái/phải VÀ cùng phòng (tường ngăn thì không tính).
  function besideCells(puz, c) {
    return neighbors(puz.n, c).filter(function (d) { return puz.rooms[d] === puz.rooms[c]; });
  }

  function unaryOk(puz, cl, c) {
    switch (cl.t) {
      case 'inRoom': return puz.rooms[c] === cl.r;
      case 'notInRoom': return puz.rooms[c] !== cl.r;
      case 'onObj': return puz.objects[c] === cl.o;
      case 'noObj': return !puz.objects[c];
      case 'besideObj':
        var nb = besideCells(puz, c);
        for (var i = 0; i < nb.length; i++) if (puz.objects[nb[i]] === cl.o) return true;
        return false;
    }
    throw new Error('Manh mối lạ: ' + cl.t);
  }

  // a = ô của cl.p, b = ô của cl.q
  function pairOk(puz, cl, a, b) {
    switch (cl.t) {
      case 'above': return rowOf(puz, a) < rowOf(puz, b);
      case 'left': return colOf(puz, a) < colOf(puz, b);
      case 'sameRoom': return puz.rooms[a] === puz.rooms[b];
      case 'diffRoom': return puz.rooms[a] !== puz.rooms[b];
    }
    throw new Error('Manh mối lạ: ' + cl.t);
  }

  // Kiểm tra một cách xếp đầy đủ có thỏa mọi luật và manh mối không.
  function validate(puz, pos) {
    var n = puz.n, P = puz.people.length, V = P - 1, i, p, q;
    var usedR = {}, usedC = {};
    for (p = 0; p < P; p++) {
      var c = pos[p];
      if (c == null || c < 0 || c >= n * n) return false;
      if (!walkable(puz, c)) return false;
      var r = rowOf(puz, c), k = colOf(puz, c);
      if (usedR[r] || usedC[k]) return false;
      usedR[r] = usedC[k] = true;
    }
    for (i = 0; i < puz.clues.length; i++) {
      var cl = puz.clues[i];
      if (UNARY[cl.t]) { if (!unaryOk(puz, cl, pos[cl.p])) return false; }
      else if (PAIR[cl.t]) { if (!pairOk(puz, cl, pos[cl.p], pos[cl.q])) return false; }
      else if (cl.t === 'alone') {
        for (q = 0; q < P; q++) if (q !== cl.p && puz.rooms[pos[q]] === puz.rooms[pos[cl.p]]) return false;
      }
    }
    var vr = puz.rooms[pos[V]], cnt = 0;
    for (p = 0; p < V; p++) if (puz.rooms[pos[p]] === vr) cnt++;
    return cnt === 1;
  }

  function murdererOf(puz, pos) {
    var V = victimIndex(puz), vr = puz.rooms[pos[V]];
    for (var p = 0; p < V; p++) if (puz.rooms[pos[p]] === vr) return p;
    return -1;
  }

  function popcount(x) { var c = 0; while (x) { x &= x - 1; c++; } return c; }

  /*
   * Bộ giải "kiểu người": chỉ loại trừ bằng suy luận chắc chắn, không đoán.
   * level 1 (Dễ): chỉ suy từ người ĐÃ chốt chỗ. Lọc ô theo manh mối của từng người;
   *   người đã chốt gạch hàng/cột của mình; manh mối hai người, "một mình" và luật hung thủ
   *   chỉ dùng khi người kia đã chốt; chốt người khi chỉ còn 1 ô, hoặc khi một hàng/cột
   *   chỉ còn đúng 1 ô cho đúng 1 người. Mỗi bước luôn có một người chốt được ngay.
   * level 2 (Vừa): thêm suy luận trên ô ứng viên chưa chốt: người bị dồn vào 1 hàng/cột,
   *   hàng/cột chỉ còn 1 người, manh mối hai người khi cả hai chưa chốt, phòng bắt buộc.
   * level 3 (Khó): thêm cặp (2 người chiếm trọn 2 hàng/cột).
   * level 4 (Rất khó): thêm bộ ba (3 người chiếm trọn 3 hàng/cột).
   * Nếu giải xong (mỗi người còn đúng 1 ô) thì lời giải là duy nhất.
   */
  // given (tùy chọn): ô đã biết chắc của từng người (-1 = chưa biết), dùng cho Gợi ý.
  // Kết quả có fixedAt[p]: vòng suy luận mà người p bị chốt (0 = ngay từ manh mối riêng).
  function logicSolve(puz, level, given) {
    var n = puz.n, N = n * n, P = puz.people.length, V = P - 1;
    var rooms = puz.rooms, i, p, q, c, d;
    var cand = [];
    for (p = 0; p < P; p++) {
      cand[p] = [];
      for (c = 0; c < N; c++) cand[p][c] = walkable(puz, c) && (!given || given[p] == null || given[p] < 0 || given[p] === c);
    }
    var pairClues = [], aloneSet = [];
    for (i = 0; i < puz.clues.length; i++) {
      var cl = puz.clues[i];
      if (UNARY[cl.t]) {
        for (c = 0; c < N; c++) if (cand[cl.p][c] && !unaryOk(puz, cl, c)) cand[cl.p][c] = false;
      } else if (PAIR[cl.t]) pairClues.push(cl);
      else if (cl.t === 'alone') aloneSet.push(cl.p);
    }

    var changed = true, rounds = 0, contradiction = false;
    function remove(pp, cc) { if (cand[pp][cc]) { cand[pp][cc] = false; changed = true; } }
    function forcedRoom(pp) {
      var r = -1;
      for (var cc = 0; cc < N; cc++) if (cand[pp][cc]) {
        if (r === -1) r = rooms[cc]; else if (rooms[cc] !== r) return -1;
      }
      return r;
    }
    function allowedSubset(k) {
      // Nhóm 4 trên lưới 8×8 người chơi gần như không thấy được bằng mắt: dừng ở nhóm 3.
      if (level >= 4) return k <= 3 || k >= P - 3;
      if (level === 3) return k <= 2 || k >= P - 2;
      return k === 1 || k === P - 1;
    }
    function placedCell(pp) {
      var at = -1;
      for (var cc = 0; cc < N; cc++) if (cand[pp][cc]) { if (at >= 0) return -1; at = cc; }
      return at;
    }
    function keepOnly(pp, cc) { for (var x = 0; x < N; x++) if (x !== cc) remove(pp, x); }
    // Cấp Dễ: mọi suy luận đều xuất phát từ người đã chốt chỗ.
    function easyRules() {
      var pl = [], pp, qq, cc, x;
      for (pp = 0; pp < P; pp++) pl[pp] = placedCell(pp);
      for (pp = 0; pp < P; pp++) {
        if (pl[pp] < 0) continue;
        var r0 = Math.floor(pl[pp] / n), k0 = pl[pp] % n;
        for (qq = 0; qq < P; qq++) if (qq !== pp)
          for (cc = 0; cc < N; cc++) if (Math.floor(cc / n) === r0 || cc % n === k0) remove(qq, cc);
      }
      for (x = 0; x < pairClues.length; x++) {
        var pc = pairClues[x];
        if (pl[pc.q] >= 0) for (cc = 0; cc < N; cc++) if (cand[pc.p][cc] && !pairOk(puz, pc, cc, pl[pc.q])) remove(pc.p, cc);
        if (pl[pc.p] >= 0) for (cc = 0; cc < N; cc++) if (cand[pc.q][cc] && !pairOk(puz, pc, pl[pc.p], cc)) remove(pc.q, cc);
      }
      for (x = 0; x < aloneSet.length; x++) {
        pp = aloneSet[x];
        for (qq = 0; qq < P; qq++) {
          if (qq === pp) continue;
          if (pl[pp] >= 0) for (cc = 0; cc < N; cc++) if (rooms[cc] === rooms[pl[pp]]) remove(qq, cc);
          if (pl[qq] >= 0) for (cc = 0; cc < N; cc++) if (rooms[cc] === rooms[pl[qq]]) remove(pp, cc);
        }
      }
      // Nạn nhân và một nghi phạm đã chốt cùng phòng → các nghi phạm khác không vào phòng đó.
      if (pl[V] >= 0) {
        var vr = rooms[pl[V]];
        for (pp = 0; pp < V; pp++) {
          if (pl[pp] < 0 || rooms[pl[pp]] !== vr) continue;
          for (qq = 0; qq < V; qq++) if (qq !== pp)
            for (cc = 0; cc < N; cc++) if (rooms[cc] === vr) remove(qq, cc);
        }
      }
      // Một hàng/cột chỉ còn đúng 1 ô trống cho đúng 1 người → người đó ở ô ấy.
      for (var byRow = 0; byRow < 2; byRow++) {
        for (var line = 0; line < n; line++) {
          var hitP = -1, hitC = -1, hits = 0;
          for (pp = 0; pp < P && hits < 2; pp++) for (var j = 0; j < n; j++) {
            cc = byRow ? line * n + j : j * n + line;
            if (cand[pp][cc]) { hits++; hitP = pp; hitC = cc; }
          }
          if (hits === 0) { contradiction = true; return; }
          if (hits === 1) keepOnly(hitP, hitC);
        }
      }
    }
    function subsetRule(byRow) {
      var masks = [];
      for (var pp = 0; pp < P; pp++) {
        var m = 0;
        for (var cc = 0; cc < N; cc++) if (cand[pp][cc]) m |= 1 << (byRow ? Math.floor(cc / n) : cc % n);
        masks[pp] = m;
      }
      var full = (1 << P) - 1;
      for (var S = 1; S < full; S++) {
        var k = popcount(S);
        if (!allowedSubset(k)) continue;
        var u = 0;
        for (pp = 0; pp < P; pp++) if (S & (1 << pp)) u |= masks[pp];
        var uc = popcount(u);
        if (uc < k) { contradiction = true; return; }
        if (uc === k) {
          for (pp = 0; pp < P; pp++) {
            if (S & (1 << pp)) continue;
            if (!(masks[pp] & u)) continue;
            for (cc = 0; cc < N; cc++) {
              var line = byRow ? Math.floor(cc / n) : cc % n;
              if (cand[pp][cc] && (u & (1 << line))) remove(pp, cc);
            }
            masks[pp] &= ~u;
          }
        }
      }
    }
    function supported(cl, cp, forP) {
      // cp: ô đang xét của (forP ? cl.p : cl.q); tìm ô của người còn lại thỏa manh mối
      var other = forP ? cl.q : cl.p;
      for (var dd = 0; dd < N; dd++) {
        if (!cand[other][dd]) continue;
        if (Math.floor(dd / n) === Math.floor(cp / n) || dd % n === cp % n) continue;
        if (forP ? pairOk(puz, cl, cp, dd) : pairOk(puz, cl, dd, cp)) return true;
      }
      return false;
    }

    var fixedAt = [];
    function markFixed() {
      for (var pp = 0; pp < P; pp++) if (fixedAt[pp] == null && placedCell(pp) >= 0) fixedAt[pp] = rounds;
    }
    markFixed();

    while (changed && !contradiction) {
      changed = false;
      rounds++;
      if (level <= 1) {
        easyRules();
        for (p = 0; p < P; p++) if (placedCell(p) < 0) {
          var none = true;
          for (c = 0; c < N; c++) if (cand[p][c]) { none = false; break; }
          if (none) contradiction = true;
        }
        markFixed();
        continue;
      }
      subsetRule(true);
      subsetRule(false);

      for (i = 0; i < pairClues.length; i++) {
        var pc = pairClues[i];
        for (c = 0; c < N; c++) {
          if (cand[pc.p][c] && !supported(pc, c, true)) remove(pc.p, c);
          if (cand[pc.q][c] && !supported(pc, c, false)) remove(pc.q, c);
        }
      }

      var fr = [];
      for (p = 0; p < P; p++) fr[p] = forcedRoom(p);

      for (i = 0; i < aloneSet.length; i++) {
        p = aloneSet[i];
        for (c = 0; c < N; c++) {
          if (!cand[p][c]) continue;
          for (q = 0; q < P; q++) if (q !== p && fr[q] === rooms[c]) { remove(p, c); break; }
        }
        if (fr[p] >= 0) for (q = 0; q < P; q++) if (q !== p)
          for (c = 0; c < N; c++) if (rooms[c] === fr[p]) remove(q, c);
      }

      // Luật hung thủ: phòng của nạn nhân có đúng 1 nghi phạm.
      for (c = 0; c < N; c++) {
        if (!cand[V][c]) continue;
        var R = rooms[c], forced = 0, possible = 0;
        for (q = 0; q < V; q++) {
          if (fr[q] === R) forced++;
          for (d = 0; d < N; d++) {
            if (cand[q][d] && rooms[d] === R && Math.floor(d / n) !== Math.floor(c / n) && d % n !== c % n) { possible++; break; }
          }
        }
        if (forced >= 2 || possible === 0) remove(V, c);
      }
      var vr = forcedRoom(V);
      if (vr >= 0) {
        var forcedList = [], canList = [];
        for (q = 0; q < V; q++) {
          if (forcedRoom(q) === vr) forcedList.push(q);
          for (d = 0; d < N; d++) if (cand[q][d] && rooms[d] === vr) { canList.push(q); break; }
        }
        if (forcedList.length === 1) {
          for (q = 0; q < V; q++) if (q !== forcedList[0])
            for (c = 0; c < N; c++) if (rooms[c] === vr) remove(q, c);
        }
        if (canList.length === 1) {
          for (c = 0; c < N; c++) if (rooms[c] !== vr) remove(canList[0], c);
        }
      }

      for (p = 0; p < P; p++) {
        var any = false;
        for (c = 0; c < N; c++) if (cand[p][c]) { any = true; break; }
        if (!any) contradiction = true;
      }
      markFixed();
    }

    var pos = [], solved = !contradiction;
    for (p = 0; p < P && solved; p++) {
      var cells = [];
      for (c = 0; c < N; c++) if (cand[p][c]) cells.push(c);
      if (cells.length !== 1) solved = false; else pos[p] = cells[0];
    }
    if (solved && !validate(puz, pos)) solved = false;
    return { solved: solved, contradiction: contradiction, rounds: rounds, cand: cand, pos: solved ? pos : null, fixedAt: fixedAt };
  }

  // Kỹ thuật suy luận mà mỗi cấp đòi hỏi (khớp với tools/generate.js).
  var LEVEL_LOGIC = { de: 1, vua: 2, kho: 3, ratkho: 4 };
  function logicLevel(puz) { return LEVEL_LOGIC[puz.level] || 4; }

  // Đếm lời giải bằng vét cạn (dùng để kiểm định độc lập với bộ giải logic).
  function countSolutions(puz, limit, maxNodes) {
    var n = puz.n, N = n * n, P = puz.people.length, V = P - 1;
    limit = limit || 2; maxNodes = maxNodes || 5e6;
    var cand = [], p, c, i;
    for (p = 0; p < P; p++) cand[p] = [];
    for (p = 0; p < P; p++) {
      for (c = 0; c < N; c++) {
        if (!walkable(puz, c)) continue;
        var ok = true;
        for (i = 0; i < puz.clues.length && ok; i++) {
          var cl = puz.clues[i];
          if (UNARY[cl.t] && cl.p === p && !unaryOk(puz, cl, c)) ok = false;
        }
        if (ok) cand[p].push(c);
      }
    }
    var order = [];
    for (p = 0; p < P; p++) order.push(p);
    order.sort(function (a, b) { return cand[a].length - cand[b].length; });
    var pos = [], usedR = [], usedC = [], count = 0, nodes = 0, aborted = false, sols = [];
    for (p = 0; p < P; p++) pos[p] = -1;
    var alone = {};
    for (i = 0; i < puz.clues.length; i++) if (puz.clues[i].t === 'alone') alone[puz.clues[i].p] = true;

    function partialOk(pp, cc) {
      for (var j = 0; j < puz.clues.length; j++) {
        var cl = puz.clues[j];
        if (!PAIR[cl.t]) continue;
        if (cl.p === pp && pos[cl.q] >= 0 && !pairOk(puz, cl, cc, pos[cl.q])) return false;
        if (cl.q === pp && pos[cl.p] >= 0 && !pairOk(puz, cl, pos[cl.p], cc)) return false;
      }
      for (var qq = 0; qq < P; qq++) {
        if (pos[qq] < 0) continue;
        if (puz.rooms[pos[qq]] === puz.rooms[cc] && (alone[pp] || alone[qq])) return false;
      }
      var vc = pp === V ? cc : pos[V];
      if (vc >= 0) {
        var cnt = 0;
        for (qq = 0; qq < V; qq++) {
          var qc = qq === pp ? cc : pos[qq];
          if (qc >= 0 && puz.rooms[qc] === puz.rooms[vc]) cnt++;
        }
        if (cnt > 1) return false;
      }
      return true;
    }
    function rec(k) {
      if (aborted || count >= limit) return;
      if (++nodes > maxNodes) { aborted = true; return; }
      if (k === P) {
        if (validate(puz, pos)) { count++; sols.push(pos.slice()); }
        return;
      }
      var pp = order[k], list = cand[pp];
      for (var j = 0; j < list.length; j++) {
        var cc = list[j], r = Math.floor(cc / n), col = cc % n;
        if (usedR[r] || usedC[col]) continue;
        if (!partialOk(pp, cc)) continue;
        pos[pp] = cc; usedR[r] = usedC[col] = true;
        rec(k + 1);
        pos[pp] = -1; usedR[r] = usedC[col] = false;
        if (aborted || count >= limit) return;
      }
    }
    rec(0);
    return { count: count, aborted: aborted, solutions: sols };
  }

  return {
    OBJECTS: OBJECTS, UNARY: UNARY, PAIR: PAIR,
    victimIndex: victimIndex, rowOf: rowOf, colOf: colOf, walkable: walkable, neighbors: neighbors, besideCells: besideCells,
    unaryOk: unaryOk, pairOk: pairOk, validate: validate, murdererOf: murdererOf,
    logicSolve: logicSolve, logicLevel: logicLevel, LEVEL_LOGIC: LEVEL_LOGIC, countSolutions: countSolutions
  };
}));
