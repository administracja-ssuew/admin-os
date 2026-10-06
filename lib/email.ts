const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
}

interface SendEmailDeps {
  fetch?: typeof fetch
  env?: Record<string, string | undefined>
}

export type SendEmailResult = { success: boolean; skipped?: boolean; error?: string }

/**
 * Wysyłka przez Google Apps Script (scripts/gas/mailer.gs) — bez Resend i konfiguracji DNS.
 * Brak MAIL_GAS_URL/MAIL_GAS_TOKEN oznacza pominięcie e-maila, nie błąd aplikacji.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams, deps: SendEmailDeps = {}): Promise<SendEmailResult> {
  const env = deps.env ?? process.env
  const doFetch = deps.fetch ?? fetch
  const url = env.MAIL_GAS_URL
  const token = env.MAIL_GAS_TOKEN
  if (!url || !token) {
    console.warn('E-mail pominięty: brak MAIL_GAS_URL lub MAIL_GAS_TOKEN')
    return { success: false, skipped: true }
  }
  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, to: Array.isArray(to) ? to : [to], subject: `[AdminOS] ${subject}`, html: wrapInTemplate(html) }),
    })
    const data = await res.json().catch(() => null)
    if (!data?.ok) {
      const error = data?.error ?? `HTTP ${res.status}`
      console.error('Email send error:', error)
      return { success: false, error }
    }
    return { success: true }
  } catch (err) {
    console.error('Email send exception:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function wrapInTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#0f172a;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;color:#3b82f6;font-size:20px;font-weight:800;letter-spacing:1px;">AdminOS</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Komisja Weryfikacyjna</p>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-top:none;">
      ${content}
    </div>
    <div style="padding:16px 24px;text-align:center;background:#f8fafc;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        Wiadomość wygenerowana automatycznie przez system AdminOS.
        <br><a href="${APP_URL}" style="color:#3b82f6;text-decoration:none;">Przejdź do systemu</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export { APP_URL }
