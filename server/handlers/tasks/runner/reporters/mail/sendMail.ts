import sgMail from '@sendgrid/mail';

import { logger } from 'note-down';

export const sendMail = async function (
    {
        apiKey
    },
    {
        from,
        to,
        cc,
        bcc,
        subject,
        body
    }
) {
    sgMail.setApiKey(apiKey);
    const msg = {
        from,
        to,
        cc,
        bcc,
        subject,
        html: body
    };

    try {
        if (process.env.DISABLE_MAIL === 'yes') {
            return [null, 'DISABLE_MAIL=yes (Mail is disabled) ; Skipping sending mail'];
        } else {
            const status = await sgMail.send(msg);
            return [null, null, status];
        }
    } catch (e) {
        logger.error(e);
        return [e];
    }
};
