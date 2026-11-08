// One-off: extract platonusDebugHtml from the extension's chrome.storage.local
// LevelDB (Vivaldi profile) into a plain HTML file for parser calibration.
// Берёт ПОСЛЕДНЕЕ значение ключа (лог аппендится), ищет и в .log и в .ldb.
const fs = require('fs');
const path = require('path');

const base = 'C:/Users/zxrd/AppData/Local/Vivaldi/User Data/Default/Local Extension Settings/hmmcfomofmmbfmkblidlkkgfmbddeaaa';
const needle = Buffer.from('platonusDebugHtml');

function findClosingQuote(buf, start) {
  let j = start + 1;
  while (j < buf.length) {
    if (buf[j] === 0x5C) { j += 2; continue; }
    if (buf[j] === 0x22) break;
    j++;
  }
  return j;
}

function unescapeJsonString(s) {
  let out = '';
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') {
      const n = s[k + 1];
      if (n === 'n') { out += '\n'; k++; }
      else if (n === 't') { out += '\t'; k++; }
      else if (n === 'r') { out += '\r'; k++; }
      else if (n === '"') { out += '"'; k++; }
      else if (n === '\\') { out += '\\'; k++; }
      else if (n === '/') { out += '/'; k++; }
      else if (n === 'u') { out += String.fromCharCode(parseInt(s.substr(k + 2, 4), 16)); k += 5; }
      else { out += c; }
    } else out += c;
  }
  return out;
}

const hits = [];
for (const f of fs.readdirSync(base)) {
  if (!/\.(log|ldb)$/.test(f)) continue;
  const buf = fs.readFileSync(path.join(base, f));
  let idx = 0;
  for (;;) {
    const at = buf.indexOf(needle, idx);
    if (at === -1) break;
    idx = at + 1;
    let i = at + needle.length;
    while (buf[i] !== 0x22 && i < buf.length) i++; // до открывающей кавычки значения
    if (i >= buf.length) continue;
    const end = findClosingQuote(buf, i);
    hits.push({ f, at, start: i, end, buf });
  }
}
if (hits.length === 0) { console.error('key not found'); process.exit(1); }
// последнее вхождение по позиции в файле; .log считаем новее .ldb
hits.sort((a, b) => {
  const fa = a.f.endsWith('.log') ? 1 : 0;
  const fb = b.f.endsWith('.log') ? 1 : 0;
  return fa !== fb ? fb - fa : a.at - b.at;
});
const last = hits[hits.length - 1];
console.log('occurrences:', hits.length, '-> taking', last.f, '@', last.at, 'len', last.end - last.start);
const s = last.buf.slice(last.start + 1, last.end).toString('utf8');
const html = unescapeJsonString(s);
fs.writeFileSync(__dirname + '/platonus-dump-sample.html', html);
console.log('html length:', html.length);
console.log('has MARKS MODAL marker:', html.includes('MARKS MODAL'));
console.log('Ср.тек count:', (html.match(/Ср\.тек/g) || []).length);
const modalIdx = html.indexOf('MARKS MODAL');
const modalPart = modalIdx !== -1 ? html.slice(modalIdx) : '';
console.log('modal part length:', modalPart.length);
console.log('modal tables:', (modalPart.match(/<table/g) || []).length);
console.log('modal Месяц rows:', (modalPart.match(/Месяц/g) || []).length);
console.log('modal Оценка rows:', (modalPart.match(/Оценка/g) || []).length);
