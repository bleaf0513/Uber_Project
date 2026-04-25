const nodemailer = require('nodemailer');

function getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = String(process.env.SMTP_SECURE || 'true') === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        console.warn('[EMAIL] SMTP no configurado. No se enviará correo.');
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        },
    });
}

function getFrom() {
    return process.env.SMTP_FROM || process.env.SMTP_USER || 'Central Go';
}

async function sendMail({ to, subject, html, text }) {
    try {
        const transporter = getTransporter();

        if (!transporter) {
            return {
                sent: false,
                reason: 'smtp_not_configured',
            };
        }

        if (!to) {
            return {
                sent: false,
                reason: 'missing_to',
            };
        }

        const info = await transporter.sendMail({
            from: getFrom(),
            to,
            subject,
            html,
            text,
        });

        console.log('[EMAIL] Correo enviado:', {
            to,
            subject,
            messageId: info.messageId,
        });

        return {
            sent: true,
            messageId: info.messageId,
        };
    } catch (error) {
        console.error('[EMAIL] Error enviando correo:', error);

        return {
            sent: false,
            reason: error.message,
        };
    }
}

async function sendDriverApplicationApprovedEmail({ to, name }) {
    const displayName = name || 'Conductor';

    return sendMail({
        to,
        subject: 'Tu solicitud en Central Go fue aprobada',
        text: `Hola ${displayName}. Tu solicitud como conductor en Central Go fue aprobada. Ya puedes iniciar sesión en la aplicación con tu correo y contraseña registrados.`,
        html: `
            <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px;">
                <div style="max-width:620px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e2e8f0;">
                    <div style="background:#064e3b; color:#ffffff; padding:24px;">
                        <h1 style="margin:0; font-size:24px;">Central Go</h1>
                        <p style="margin:8px 0 0;">Solicitud aprobada</p>
                    </div>

                    <div style="padding:24px; color:#0f172a;">
                        <h2 style="margin-top:0;">Hola ${displayName}</h2>

                        <p>Tu solicitud como conductor/transportador en <strong>Central Go</strong> fue aprobada.</p>

                        <p>Ya puedes iniciar sesión en la aplicación con el correo y contraseña que registraste.</p>

                        <div style="margin:24px 0; padding:16px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:14px; color:#065f46;">
                            <strong>Estado:</strong> Aprobado
                        </div>

                        <p style="font-size:14px; color:#64748b;">
                            Si tienes problemas para ingresar, comunícate con soporte de Central Go.
                        </p>
                    </div>
                </div>
            </div>
        `,
    });
}

async function sendDriverApplicationRejectedEmail({ to, name, reason }) {
    const displayName = name || 'Conductor';
    const cleanReason = reason || 'No se especificó un motivo.';

    return sendMail({
        to,
        subject: 'Tu solicitud en Central Go fue rechazada',
        text: `Hola ${displayName}. Tu solicitud como conductor en Central Go fue rechazada. Motivo: ${cleanReason}`,
        html: `
            <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px;">
                <div style="max-width:620px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e2e8f0;">
                    <div style="background:#7f1d1d; color:#ffffff; padding:24px;">
                        <h1 style="margin:0; font-size:24px;">Central Go</h1>
                        <p style="margin:8px 0 0;">Solicitud rechazada</p>
                    </div>

                    <div style="padding:24px; color:#0f172a;">
                        <h2 style="margin-top:0;">Hola ${displayName}</h2>

                        <p>Tu solicitud como conductor/transportador en <strong>Central Go</strong> fue rechazada.</p>

                        <div style="margin:24px 0; padding:16px; background:#fef2f2; border:1px solid #fecaca; border-radius:14px; color:#991b1b;">
                            <strong>Motivo:</strong> ${cleanReason}
                        </div>

                        <p>Puedes corregir la información indicada y enviar una nueva solicitud si aplica.</p>
                    </div>
                </div>
            </div>
        `,
    });
}

module.exports = {
    sendMail,
    sendDriverApplicationApprovedEmail,
    sendDriverApplicationRejectedEmail,
};