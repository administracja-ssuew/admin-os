// AdminOS — wysyłka e-maili. Wklej do projektu Google Apps Script, w Ustawieniach projektu
// dodaj właściwość skryptu TOKEN (ta sama wartość co MAIL_GAS_TOKEN w Vercel), a potem
// Wdróż → Nowe wdrożenie → Aplikacja internetowa: „Wykonaj jako: ja”, „Kto ma dostęp: każdy”.
// Adres wdrożenia (…/exec) wpisz w Vercel jako MAIL_GAS_URL.
var MAX_HTML = 100000 // najdłuższa przyjmowana treść HTML (znaki)

function doPost(e) {
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN')
  var body
  try {
    body = JSON.parse(e.postData.contents)
  } catch (err) {
    return json({ ok: false, error: 'bad json' })
  }
  if (!token || !body || body.token !== token) return json({ ok: false, error: 'unauthorized' })
  var to = [].concat(body.to || []).filter(function (a) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(a)) })
  if (!to.length || !body.subject || !body.html) return json({ ok: false, error: 'missing fields' })
  if (to.length > 50) return json({ ok: false, error: 'too many recipients' })
  // Treść z aplikacji ma kilka KB — dłuższej nie przycinamy (urwany HTML), tylko odrzucamy
  var html = String(body.html)
  if (html.length > MAX_HTML) return json({ ok: false, error: 'html too long' })
  // Błąd MailApp (limit, zły adres, awaria) zwracamy jako JSON, nie jako stronę błędu Apps Script
  try {
    if (MailApp.getRemainingDailyQuota() < to.length) return json({ ok: false, error: 'quota' })
    MailApp.sendEmail({ to: to.join(','), subject: String(body.subject).slice(0, 250), htmlBody: html, name: 'AdminOS' })
    return json({ ok: true, remaining: MailApp.getRemainingDailyQuota() })
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err).slice(0, 500) })
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
