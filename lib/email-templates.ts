import { APP_URL } from './email.ts'

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Tytuł i numer pochodzą z publicznego formularza — zawsze escapowane
export function externalSubmissionConfirmationTemplate(caseNumber: string, title: string) {
  return {
    subject: `Potwierdzenie przyjęcia wniosku ${caseNumber}`,
    html: `
      <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;">Wniosek przyjęty</h2>
      <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">
        Potwierdzamy przyjęcie Twojego wniosku do Komisji Weryfikacyjnej.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:12px 0;">
        <p style="margin:0 0 4px;color:#166534;font-size:12px;font-weight:600;">NUMER SPRAWY</p>
        <p style="margin:0;color:#1e293b;font-size:18px;font-weight:700;font-family:monospace;">${escapeHtml(caseNumber)}</p>
      </div>
      <p style="margin:12px 0;color:#475569;font-size:14px;">
        Tytuł: <strong>${escapeHtml(title)}</strong>
      </p>
      <p style="margin:12px 0;color:#475569;font-size:14px;line-height:1.6;">
        Zachowaj ten numer — status sprawdzisz, podając go razem z adresem e-mail z wniosku.
      </p>
      <a href="${APP_URL}/wniosek/status?nr=${encodeURIComponent(caseNumber)}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Sprawdź status wniosku
      </a>
    `,
  }
}

/** Jeden szablon dla wszystkich powiadomień: tytuł, opis i przycisk do konkretnego miejsca. */
export function notificationEmailTemplate(title: string, body: string, link: string) {
  return {
    subject: title,
    html: `
      <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;">${escapeHtml(title)}</h2>
      <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">${escapeHtml(body)}</p>
      <a href="${APP_URL}${link}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Otwórz w AdminOS
      </a>
    `,
  }
}
