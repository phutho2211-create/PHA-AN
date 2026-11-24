/* Câu chữ tiếng Việt cho manh mối + hình vẽ đồ vật. */
(function (root) {
  'use strict';
  var OBJ = root.Core.OBJECTS;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }
  function who(puz, p) {
    return '<b class="pn pc' + (puz.people[p].victim ? 'v' : p) + '">' + esc(puz.people[p].name) + '</b>';
  }
  function room(puz, r) {
    return '<span class="rn" style="--h:' + Clues.roomHue(puz, r) + '">' + esc(puz.roomNames[r]) + '</span>';
  }

  // Không gian ngoài trời nói "ở ngoài ban công", "ở ngoài sân thượng"; phòng kín nói "ở trong".
  function prepName(name) { return /Ban công|Sân vườn|Sân thượng/i.test(name) ? 'ngoài' : 'trong'; }
  function prep(puz, r) { return prepName(puz.roomNames[r]); }

  // Mảnh hình SVG cho icon (viewBox 48).
  function R(x, y, w, h, f, rx) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' + (rx ? ' rx="' + rx + '"' : '') + ' fill="' + f + '"/>'; }
  function C(cx, cy, r, f) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + f + '"/>'; }
  function E(cx, cy, rx, ry, f) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + f + '"/>'; }
  function P(d, f) { return '<path d="' + d + '" fill="' + f + '"/>'; }
  function L(d, s, w) { return '<path d="' + d + '" fill="none" stroke="' + s + '" stroke-width="' + w + '"/>'; }

  function assignHues(puz) {
    var k = puz.roomNames.length, n = puz.n, adj = [], r, c;
    for (r = 0; r < k; r++) adj[r] = {};
    for (c = 0; c < n * n; c++) {
      var a = puz.rooms[c];
      if (c % n < n - 1 && puz.rooms[c + 1] !== a) { adj[a][puz.rooms[c + 1]] = 1; adj[puz.rooms[c + 1]][a] = 1; }
      if (c + n < n * n && puz.rooms[c + n] !== a) { adj[a][puz.rooms[c + n]] = 1; adj[puz.rooms[c + n]][a] = 1; }
    }
    var slots = [], used = [], hue = [], order = [];
    for (r = 0; r < k; r++) { slots.push(Math.round((r * 360 / k + 15) % 360)); order.push(r); }
    order.sort(function (x, y) { return Object.keys(adj[y]).length - Object.keys(adj[x]).length || x - y; });
    order.forEach(function (room) {
      var best = -1, bestScore = -1;
      for (var s = 0; s < k; s++) {
        if (used[s]) continue;
        var score = 999, score2 = 0;
        for (var q in adj[room]) if (hue[q] != null) {
          var d = Math.abs(slots[s] - hue[q]); d = Math.min(d, 360 - d);
          score = Math.min(score, d); score2 += d;
        }
        var total = score * 1000 + score2;
        if (total > bestScore) { bestScore = total; best = s; }
      }
      used[best] = true;
      hue[room] = slots[best];
    });
    return hue;
  }

  // Thân hình vẽ từng món, dựng một lần khi cần.
  var ICONS = null;
  function drawIcons() {
    var W = '#8b5a2b', W2 = '#b9773f', W3 = '#d8975a';
    return {
        chair:
          '<rect x="12" y="4" width="4.5" height="24" fill="' + W + '"/><rect x="31.5" y="4" width="4.5" height="24" fill="' + W + '"/>' +
          '<rect x="11" y="3" width="26" height="7" rx="2.5" fill="' + W2 + '"/><rect x="16.5" y="14" width="15" height="4" fill="' + W2 + '"/>' +
          '<path d="M7 26h34l-3.5 8h-27z" fill="' + W3 + '"/>' +
          '<rect x="12" y="34" width="4.5" height="11" fill="' + W + '"/><rect x="31.5" y="34" width="4.5" height="11" fill="' + W + '"/>',
        rug:
          '<path d="M11 3v5M16 3v5M21 3v5M27 3v5M32 3v5M37 3v5M11 40v5M16 40v5M21 40v5M27 40v5M32 40v5M37 40v5" stroke="#c9ad7a" stroke-width="2"/>' +
          '<rect x="6" y="8" width="36" height="32" rx="2" fill="#b8433a"/>' +
          '<rect x="10.5" y="12.5" width="27" height="23" fill="none" stroke="#f1c27d" stroke-width="2"/>' +
          '<path d="M24 15l8 9-8 9-8-9z" fill="#f1c27d"/><path d="M24 19.5l4 4.5-4 4.5-4-4.5z" fill="#2f5d8a"/>',
        bed:
          '<rect x="8" y="3" width="32" height="42" rx="3.5" fill="' + W + '"/>' +
          '<rect x="11" y="6" width="26" height="36" rx="2" fill="#f4f1ea"/>' +
          '<rect x="14" y="8.5" width="20" height="8" rx="3.5" fill="#ffffff"/>' +
          '<rect x="11" y="20" width="26" height="22" rx="2" fill="#4f7cac"/><rect x="11" y="20" width="26" height="5" rx="2" fill="#7ea6d1"/>',
        table:
          '<rect x="19" y="5" width="10" height="8" rx="2" fill="#e9e3d6"/><path d="M21 5c0-3 6-3 6 0" fill="none" stroke="#3f8f47" stroke-width="2"/>' +
          '<rect x="3.5" y="13" width="41" height="7" rx="2.5" fill="' + W2 + '"/><rect x="7" y="20" width="34" height="4" fill="' + W + '"/>' +
          '<rect x="8" y="20" width="5" height="24" fill="' + W + '"/><rect x="35" y="20" width="5" height="24" fill="' + W + '"/>',
        plant:
          '<path d="M24 31V11" stroke="#2f6b3a" stroke-width="2.4"/>' +
          '<path d="M24 23C15 23 9 17 9 9c9 0 15 5 15 14z" fill="#4caf50"/>' +
          '<path d="M24 18c7 0 13-5 14-13-9 0-14 5-14 13z" fill="#3e8e41"/>' +
          '<path d="M24 28c6 0 10-4 11-9-7 0-10 4-11 9z" fill="#66bb6a"/>' +
          '<path d="M13 33h22l-3.5 12h-15z" fill="#c8643b"/><rect x="11" y="29" width="26" height="6" rx="2" fill="#de7a4c"/>',
        shelf:
          '<rect x="7" y="2.5" width="34" height="43" rx="2" fill="' + W + '"/><rect x="10.5" y="6" width="27" height="36" fill="#4a2f17"/>' +
          '<rect x="10.5" y="17" width="27" height="2.5" fill="' + W + '"/><rect x="10.5" y="29.5" width="27" height="2.5" fill="' + W + '"/>' +
          '<rect x="12" y="7.5" width="3.5" height="9.5" fill="#c0392b"/><rect x="16" y="9" width="3.5" height="8" fill="#2e86c1"/>' +
          '<rect x="20" y="7.5" width="3" height="9.5" fill="#f1c40f"/><rect x="23.5" y="10" width="3.5" height="7" fill="#27ae60"/>' +
          '<rect x="12" y="20.5" width="4" height="9" fill="#8e44ad"/><rect x="16.5" y="21.5" width="3.5" height="8" fill="#e67e22"/>' +
          '<rect x="29" y="20.5" width="3.5" height="9" fill="#16a085"/><rect x="33" y="22" width="3" height="7.5" fill="#c0392b"/>' +
          '<rect x="12" y="33" width="3.5" height="9" fill="#2e86c1"/><rect x="16" y="34" width="4" height="8" fill="#f1c40f"/>' +
          '<rect x="20.5" y="33" width="3" height="9" fill="#27ae60"/><rect x="30" y="34.5" width="4" height="7.5" fill="#8e44ad"/>',

        // --- Đồ đứng/ngồi được ---
        sofa:
          R(5, 11, 38, 17, '#c0504d', 5) + L('M24 13v13', '#3b2412', 1.3) + R(5, 26, 38, 10, '#d9665f', 3) +
          R(2, 19, 8, 19, '#a8403c', 3) + R(38, 19, 8, 19, '#a8403c', 3) + R(7, 38, 4, 6, W) + R(37, 38, 4, 6, W),
        armchair:
          R(11, 6, 26, 24, '#5e9c6a', 6) + R(10, 27, 28, 9, '#79b585', 3) +
          R(5, 17, 9, 21, '#4a8456', 4) + R(34, 17, 9, 21, '#4a8456', 4) + R(8, 38, 4, 7, W) + R(36, 38, 4, 7, W),
        stool:
          R(5, 13, 38, 8, '#7a3e8e', 3) + R(8, 21, 32, 5, W) + R(10, 26, 4.5, 19, W) + R(33.5, 26, 4.5, 19, W),
        swing:
          R(3, 5, 4, 40, W) + R(41, 5, 4, 40, W) + R(2, 3, 44, 5, W2, 1.5) +
          L('M14 8v22M34 8v22', '#6b4a2a', 1.8) + R(9, 29, 30, 6, W3, 2),
        bench:
          R(3, 19, 42, 9, '#b8bcc0', 2) + R(3, 19, 42, 3, '#d3d6d9', 1.5) + R(7, 28, 8, 16, '#9aa0a6') + R(33, 28, 8, 16, '#9aa0a6'),
        motorbike:
          L('M35 24l4-12h5', '#3a3f45', 2.6) + P('M9 30l8-9h17l6 9z', '#d63c3c') + R(17, 16, 14, 5, '#3a3f45', 2) +
          C(11, 35, 8, '#333') + C(11, 35, 3, '#c9ced4') + C(37, 35, 8, '#333') + C(37, 35, 3, '#c9ced4'),
        lounger:
          R(7, 31, 3.5, 13, W) + R(27, 31, 3.5, 13, W) + R(37, 22, 3.5, 22, W) +
          P('M3 26h28l10-15 5 3-11 17H3z', '#4aa3d0') + L('M10 26v5M17 26v5M24 26v5', '#ffffff', 1.6),
        bathtub:
          R(36, 5, 3, 13, '#b0b6bc') + R(29, 5, 10, 3, '#b0b6bc') +
          R(9, 37, 5, 8, '#c9a24a', 1) + R(34, 37, 5, 8, '#c9a24a', 1) +
          P('M4 20h40v7c0 8-6 12-14 12H18C10 39 4 35 4 27z', '#f4f6f8') + R(2, 17, 44, 5, '#ffffff', 2) +
          C(14, 14, 3, '#dff1fb') + C(20, 12, 2.2, '#dff1fb'),

        // --- Bàn, tủ, cây ---
        desk:
          R(25, 7, 14, 9, '#5b6570', 1) + R(22, 15, 19, 2, '#3a3f45') +
          R(3, 17, 42, 6, W2, 1.5) + R(5, 23, 14, 21, W3) + L('M5 30h14M5 37h14', '#3b2412', 1.3) +
          C(12, 26.5, 1.2, '#3b2412') + C(12, 33.5, 1.2, '#3b2412') + C(12, 40.5, 1.2, '#3b2412') + R(37, 23, 5, 21, W),
        teatable:
          E(21, 20, 8, 6.5, '#5a8fbf') + R(17, 11.5, 8, 3, '#5a8fbf', 1) + L('M28.5 19l5-4', '#3b2412', 2.4) +
          R(33, 19, 6, 6, '#e9e3d6', 1) + R(4, 26, 40, 6, W2, 3) + R(8, 32, 4.5, 12, W) + R(35.5, 32, 4.5, 12, W),
        vanity:
          E(24, 13, 11, 11.5, W) + E(24, 13, 8.5, 9, '#bfe3f2') + R(19, 20, 3, 5, '#e8749a', 1) + R(25, 21, 3, 4, '#f1c27d', 1) +
          R(4, 25, 40, 5, W2, 1.5) + R(5, 30, 11, 14, W3) + R(32, 30, 11, 14, W3),
        tree:
          R(21, 28, 6, 17, '#7a4a24') + C(14, 22, 8.5, '#4caf50') + C(34, 22, 8.5, '#4caf50') + C(24, 15, 12, '#3e8e41'),
        cupboard:
          R(6, 3, 36, 42, W, 2) + R(9, 6, 14, 17, '#cfe8f2') + R(25, 6, 14, 17, '#cfe8f2') +
          C(16, 14.5, 4.5, '#ffffff') + C(32, 14.5, 4.5, '#ffffff') +
          R(9, 26, 14, 16, W2) + R(25, 26, 14, 16, W2) + C(20.5, 34, 1.3, '#f1c27d') + C(27.5, 34, 1.3, '#f1c27d'),
        wardrobe:
          R(7, 4, 34, 39, W2, 1) + R(5, 2, 38, 4, W, 1) + L('M24 6v37', '#3b2412', 1.3) +
          R(20, 19, 2, 9, '#f1c27d') + R(26, 19, 2, 9, '#f1c27d') + R(9, 43, 4, 3, W) + R(35, 43, 4, 3, W),
        cabinet:
          R(9, 3, 30, 42, '#8996a2', 2) + R(12, 6, 24, 11, '#b7c2cc') + R(12, 19.5, 24, 11, '#b7c2cc') + R(12, 33, 24, 10, '#b7c2cc') +
          R(19, 8, 10, 3, '#ffffff') + R(19, 21.5, 10, 3, '#ffffff') + R(19, 35, 10, 3, '#ffffff') +
          R(21, 13, 6, 2, '#4a5560') + R(21, 26.5, 6, 2, '#4a5560') + R(21, 39.5, 6, 2, '#4a5560'),
        shoerack:
          R(4, 14, 40, 31, W2, 2) + R(7, 17, 34, 12, '#4a2f17') +
          P('M9 28v-4h4c2 0 6 2 6 4z', '#c0392b') + P('M21 28v-4h4c2 0 6 2 6 4z', '#2e86c1') + P('M32 28v-3h3c2 0 5 1.5 5 3z', '#f1c40f') +
          R(7, 31, 34, 11, W3) + L('M24 31v11', '#3b2412', 1.3),

        // --- Thiết bị, đồ lớn ---
        tv:
          R(21, 35, 6, 5, '#555b62') + R(13, 40, 22, 4, '#555b62', 1.5) +
          R(3, 7, 42, 29, '#2b2f36', 2.5) + R(6.5, 10.5, 35, 22, '#4f86b8') + P('M9 13h9l-7 9h-2z', '#86b6e2'),
        fridge:
          R(10, 2, 28, 44, '#eef2f5', 3) + L('M10 17h28', '#3b2412', 1.3) +
          R(31, 7, 3, 7, '#9aa7b2', 1) + R(31, 21, 3, 12, '#9aa7b2', 1) + C(17, 27, 2.2, '#e74c3c') + R(15, 33, 5, 5, '#f1c40f'),
        sink:
          L('M21 19V8h9v5', '#7d8790', 3) + R(2, 18, 44, 5, '#d9dde1', 1.5) + R(13, 18, 20, 3, '#9aa7b2') +
          R(4, 23, 40, 22, W2) + R(7, 26, 16, 16, W3) + R(25, 26, 16, 16, W3) + C(20, 34, 1.3, '#3b2412') + C(28, 34, 1.3, '#3b2412'),
        stove:
          P('M14 10c-3-3-1-6 1-8 1 3 4 4 2 8z', '#ff8c2a') + P('M32 10c-3-3-1-6 1-8 1 3 4 4 2 8z', '#ff8c2a') +
          R(3, 9, 42, 5, '#3a3f45', 1) + R(5, 14, 38, 31, '#eef2f5', 2) +
          C(12, 18.5, 1.8, '#3a3f45') + C(20, 18.5, 1.8, '#3a3f45') + C(28, 18.5, 1.8, '#3a3f45') + C(36, 18.5, 1.8, '#3a3f45') +
          R(10, 23, 28, 16, '#3a3f45', 2) + R(13, 26, 22, 3, '#7d8790'),
        washer:
          R(6, 3, 36, 42, '#f4f6f8', 3) + L('M6 11h36', '#3b2412', 1.3) + C(35, 7, 2.3, '#9aa7b2') + R(10, 5.5, 12, 3, '#9aa7b2', 1) +
          C(24, 28, 12, '#b0bac3') + C(24, 28, 8.5, '#7fc4e8') + P('M15.5 29c3-2 5 2 8.5 0s5.5-2 8.5 0v3c-3 4-14 4-17 0z', '#4aa3d0'),
        basin:
          R(14, 2, 20, 13, '#bfe3f2', 2) + R(22, 16, 4, 6, '#9aa7b2', 1) + R(20, 33, 8, 12, '#e9edf0') +
          P('M5 22h38c0 8-7 13-19 13S5 30 5 22z', '#ffffff'),
        toilet:
          R(13, 3, 22, 13, '#ffffff', 2) + R(22, 5.5, 4, 2.5, '#9aa7b2', 1) + R(17, 34, 14, 10, '#e9edf0', 1) +
          P('M9 21c0 9 6 15 15 15s15-6 15-15z', '#ffffff') + E(24, 21, 15, 4.5, '#f4f6f8'),
        piano:
          R(4, 3, 40, 22, '#3a2a22', 2) + R(17, 7, 14, 10, '#f4f1ea') + R(3, 23, 42, 9, '#3a2a22') + R(5, 24.5, 38, 6, '#ffffff') +
          R(10, 24.5, 3, 3.8, '#111111') + R(16, 24.5, 3, 3.8, '#111111') + R(25, 24.5, 3, 3.8, '#111111') + R(31, 24.5, 3, 3.8, '#111111') + R(37, 24.5, 3, 3.8, '#111111') +
          R(6, 32, 5, 13, '#3a2a22') + R(37, 32, 5, 13, '#3a2a22'),
        clock:
          R(15, 14, 18, 30, W) + R(13, 42, 22, 4, W2, 1) + R(12, 2, 24, 18, W2, 4) + C(24, 11, 7, '#f4f1ea') +
          L('M24 11V6.5M24 11l3.5 2', '#3b2412', 1.6) + R(19, 23, 10, 16, '#4a2f17', 4) +
          L('M24 23v10', '#f1c27d', 1.5) + C(24, 34, 2.6, '#f1c27d'),
        dryrack:
          L('M9 45l5-37M39 45l-5-37', W, 3.2) + R(10, 6, 28, 3, '#9aa7b2', 1) +
          P('M14 9h9l2 4-2 1v11h-9V14l-2-1z', '#e74c3c') + R(27, 9, 8, 17, '#4aa3d0'),
        well:
          R(9, 6, 3.5, 20, W) + R(35.5, 6, 3.5, 20, W) + P('M5 10L24 2l19 8z', '#c0504d') +
          L('M24 10v8', '#6b4a2a', 1.4) + R(21, 17, 6, 5, W2, 1) +
          R(7, 26, 34, 18, '#9aa0a6') + L('M7 33h34M7 39h34M15 26v7M33 26v7M24 33v6M12 39v5M36 39v5', '#3b2412', 1) +
          E(24, 26, 17, 4, '#b8bcc0') + E(24, 26, 13, 2.4, '#2b3a4a'),
        generator:
          R(4, 15, 40, 25, '#e6b422', 3) + R(2, 13, 44, 4, '#3a3f45', 1) + R(8, 20, 14, 13, '#3a3f45', 1.5) + C(15, 26.5, 3.4, '#ffffff') +
          L('M27 22h13M27 26.5h13M27 31h13', '#3b2412', 1.8) + C(10, 42, 3.5, '#333') + C(38, 42, 3.5, '#333'),
        car:
          P('M3 34v-8l6-2 7-9h16l8 9 5 2v8z', '#3d7cc9') + P('M18 17h6v7H12z', '#cfe8f2') + P('M27 17h4l6 7H27z', '#cfe8f2') +
          C(13, 34, 6, '#333') + C(13, 34, 2.4, '#c9ced4') + C(35, 34, 6, '#333') + C(35, 34, 2.4, '#c9ced4'),
        watertank:
          R(12, 33, 4, 12, '#7d8790') + R(32, 33, 4, 12, '#7d8790') + R(12, 39, 24, 2.5, '#7d8790') +
          P('M10 7h28v26c0 4-28 4-28 0z', '#d3d8dd') + L('M10 16h28M10 25h28', '#9aa7b2', 1.6) + E(24, 7, 14, 3.5, '#eef1f4'),

        // --- Kho, hầm ---
        chest:
          R(4, 20, 40, 24, W2, 2) + P('M4 21v-5c0-6 6-9 20-9s20 3 20 9v5z', W) +
          R(10, 9, 3.5, 35, '#d4a73a') + R(34.5, 9, 3.5, 35, '#d4a73a') + R(20, 18, 8, 8, '#d4a73a', 1) + C(24, 22, 1.4, '#3b2412'),
        crate:
          R(5, 7, 38, 36, W2) + R(9, 11, 30, 28, W3) + P('M9 35L35 11h4v4L13 39H9z', W2),
        rack:
          R(6, 3, 3.5, 42, '#7d8790') + R(38.5, 3, 3.5, 42, '#7d8790') +
          R(11, 5, 10, 7, '#c8a165') + R(24, 7, 9, 5, '#d4a73a') + R(12, 19, 6, 7, '#c0392b') + R(21, 20, 13, 6, '#c8a165') +
          R(10, 32, 14, 8, '#c8a165') + R(28, 34, 8, 6, '#4aa3d0') +
          R(6, 12, 36, 3, '#9aa7b2') + R(6, 26, 36, 3, '#9aa7b2') + R(6, 40, 36, 3, '#9aa7b2'),
        winerack: (function () {
          var s = R(5, 3, 38, 42, W, 1.5);
          [14, 24, 34].forEach(function (y) { [14, 24, 34].forEach(function (x) { s += C(x, y + 0, 5, '#3a2414') + C(x, y, 3, '#7b1e33'); }); });
          return s;
        }()),
        barrel:
          P('M12 4h24c4 6 4 34 0 40H12c-4-6-4-34 0-40z', W2) + L('M19 4c-2 8-2 32 0 40M29 4c2 8 2 32 0 40', W, 1.4) +
          L('M10 12h28M9.6 36h28.8', '#5b6570', 3),
        toolbox:
          L('M16 18v-6h16v6', '#3a3f45', 3) + R(4, 18, 40, 25, '#d63c3c', 2) + R(4, 18, 40, 7, '#b52f2f', 2) + R(21, 23, 6, 5, '#c9ced4', 1)
    };
  }

  var Clues = {
    esc: esc,
    who: who,
    prepName: prepName,
    // Màu phòng: chia đều vòng màu, rồi gán sao cho hai phòng sát nhau có màu cách xa nhau nhất.
    roomHue: function (puz, r) {
      if (!puz._hues) puz._hues = assignHues(puz);
      return puz._hues[r];
    },
    // Vế câu không kèm chủ ngữ, để khung lời khai chỉ nhắc tên người một lần:
    // "Nam ở trong Nhà bếp, / và ngồi trên ghế."
    part: function (puz, cl) {
      var Y = cl.q != null ? who(puz, cl.q) : '';
      switch (cl.t) {
        case 'inRoom': return 'ở ' + prep(puz, cl.r) + ' ' + room(puz, cl.r);
        case 'notInRoom': return 'không ở ' + prep(puz, cl.r) + ' ' + room(puz, cl.r);
        case 'onObj': return OBJ[cl.o].on;
        case 'noObj': return 'đứng ở ô trống';
        case 'besideObj': return 'ở sát cạnh ' + OBJ[cl.o].name;
        case 'above': return 'ở phía trên ' + Y;
        case 'left': return 'ở bên trái ' + Y;
        case 'sameRoom': return 'ở cùng phòng với ' + Y;
        case 'diffRoom': return 'khác phòng với ' + Y;
        case 'alone': return 'ở một mình trong phòng';
      }
      return '';
    },
    // Kiểu sàn theo loại phòng, để mỗi phòng có chất liệu riêng dễ phân biệt.
    floor: function (name) {
      if (/bếp|tắm/i.test(name)) return 'tile';
      if (/vườn/i.test(name)) return 'grass';
      if (/Hành lang|kho|Ban công|Sân thượng|hầm|Hầm|Gara/i.test(name)) return 'stone';
      return 'wood';
    },
    // Hình vẽ màu, nét viền đậm, đọc rõ ở ô nhỏ.
    icon: function (o) {
      var body = (ICONS || (ICONS = drawIcons()))[o];
      return '<svg viewBox="0 0 48 48" class="ico ico-' + o + '" aria-hidden="true">' +
        '<g stroke="#3b2412" stroke-width="1.3" stroke-linejoin="round">' + body + '</g></svg>';
    },
    // Dấu ✕ đỏ có viền trắng (giống bút đánh dấu).
    cross: function (auto) {
      return '<svg viewBox="0 0 24 24" class="xm' + (auto ? ' auto' : '') + '" aria-hidden="true">' +
        '<path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M6 6l12 12M18 6L6 18" stroke="#d62828" stroke-width="3.4" stroke-linecap="round"/></svg>';
    }
  };
  root.Clues = Clues;
}(this));
