import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL || 'AdminOS <system@komisja.pl>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: `[AdminOS] ${subject}`,
      html: wrapInTemplate(html),
    })

    if (error) {
      console.error('Email send error:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (err) {
    console.error('Email send exception:', err)
    return { success: false, error: err }
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
