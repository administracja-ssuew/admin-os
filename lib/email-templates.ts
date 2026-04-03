import { APP_URL } from './email'

export function taskAssignedTemplate(taskTitle: string, assignerName: string) {
  return {
    subject: `Nowe zadanie: ${taskTitle}`,
    html: `
      <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;">Przydzielono Ci zadanie</h2>
      <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6;">
        <strong>${assignerName}</strong> przydzielił/a Ci nowe zadanie:
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:12px 0;">
        <p style="margin:0;color:#1e293b;font-size:15px;font-weight:600;">${taskTitle}</p>
      </div>
      <a href="${APP_URL}/tasks" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Przejdź do zadań
      </a>
    `,
  }
}

export function caseStatusChangeTemplate(caseNumber: string, caseTitle: string, oldStatus: string, newStatus: string) {
  const statusLabels: Record<string, string> = { new: 'Nowa', in_progress: 'W toku', closed: 'Zamknięta' }
  return {
    subject: `Zmiana statusu sprawy ${caseNumber}`,
    html: `
      <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;">Status sprawy został zmieniony</h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:12px 0;">
        <p style="margin:0 0 4px;color:#64748b;font-size:12px;">Sprawa ${caseNumber}</p>
        <p style="margin:0;color:#1e293b;font-size:15px;font-weight:600;">${caseTitle}</p>
      </div>
      <p style="margin:12px 0;color:#475569;font-size:14px;">
        Status: <span style="text-decoration:line-through;color:#94a3b8;">${statusLabels[oldStatus] || oldStatus}</span>
        &rarr; <strong style="color:#3b82f6;">${statusLabels[newStatus] || newStatus}</strong>
      </p>
      <a href="${APP_URL}/cases" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Przejdź do rejestru spraw
      </a>
    `,
  }
}

export function newMeetingTemplate(meetingTitle: string, date: string, time: string | null, organizerName: string) {
  return {
    subject: `Nowe zebranie: ${meetingTitle}`,
    html: `
      <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;">Zaproszenie na zebranie</h2>
      <p style="margin:0 0 8px;color:#475569;font-size:14px;">
        <strong>${organizerName}</strong> zaprasza Cię na zebranie:
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:12px 0;">
        <p style="margin:0 0 4px;color:#1e293b;font-size:15px;font-weight:600;">${meetingTitle}</p>
        <p style="margin:0;color:#64748b;font-size:13px;">${date}${time ? `, godz. ${time}` : ''}</p>
      </div>
      <a href="${APP_URL}/meetings" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Przejdź do zebrań
      </a>
    `,
  }
}

export function caseCommentTemplate(caseNumber: string, caseTitle: string, commenterName: string, commentContent: string) {
  return {
    subject: `Nowy komentarz w sprawie ${caseNumber}`,
    html: `
      <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;">Nowy komentarz w sprawie</h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:12px 0;">
        <p style="margin:0 0 4px;color:#64748b;font-size:12px;">Sprawa ${caseNumber}</p>
        <p style="margin:0;color:#1e293b;font-size:15px;font-weight:600;">${caseTitle}</p>
      </div>
      <p style="margin:12px 0 4px;color:#475569;font-size:14px;"><strong>${commenterName}</strong> napisał/a:</p>
      <div style="background:#f0f9ff;border-left:3px solid #3b82f6;padding:8px 12px;margin:8px 0;border-radius:0 6px 6px 0;">
        <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.5;">${commentContent}</p>
      </div>
      <a href="${APP_URL}/cases" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Przejdź do sprawy
      </a>
    `,
  }
}

export function externalSubmissionAdminTemplate(caseNumber: string, title: string, email: string, caseType: string) {
  return {
    subject: `Nowy wniosek zewnętrzny: ${caseNumber}`,
    html: `
      <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;">Wpłynął nowy wniosek zewnętrzny</h2>
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:12px 0;">
        <p style="margin:0 0 4px;color:#92400e;font-size:12px;font-weight:600;">NOWY WNIOSEK</p>
        <p style="margin:0 0 4px;color:#1e293b;font-size:15px;font-weight:600;">${title}</p>
        <p style="margin:0;color:#64748b;font-size:13px;">Nr: ${caseNumber} | Typ: ${caseType} | Email: ${email}</p>
      </div>
      <a href="${APP_URL}/cases" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Przejdź do rejestru spraw
      </a>
    `,
  }
}

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
        <p style="margin:0;color:#1e293b;font-size:18px;font-weight:700;font-family:monospace;">${caseNumber}</p>
      </div>
      <p style="margin:12px 0;color:#475569;font-size:14px;">
        Tytuł: <strong>${title}</strong>
      </p>
      <p style="margin:12px 0;color:#475569;font-size:14px;line-height:1.6;">
        Zachowaj ten numer — możesz go użyć do sprawdzenia statusu wniosku.
      </p>
      <a href="${APP_URL}/wniosek/status" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Sprawdź status wniosku
      </a>
    `,
  }
}

export function deadlineReminderTemplate(taskTitle: string, deadline: string) {
  return {
    subject: `Przypomnienie: termin zadania "${taskTitle}" upływa jutro`,
    html: `
      <h2 style="margin:0 0 12px;color:#1e293b;font-size:18px;">Zbliża się termin zadania</h2>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:12px 0;">
        <p style="margin:0 0 4px;color:#991b1b;font-size:12px;font-weight:600;">TERMIN: ${deadline}</p>
        <p style="margin:0;color:#1e293b;font-size:15px;font-weight:600;">${taskTitle}</p>
      </div>
      <a href="${APP_URL}/tasks" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Przejdź do zadań
      </a>
    `,
  }
}
