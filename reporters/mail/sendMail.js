const sgMail = require('@sendgrid/mail');

const {
    logger,
    noteDown
} = require('note-down');
const chalk = noteDown.chalk;

const sendMail = async function (
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
            console.warn(chalk.yellow(`\n ⚠️ DISABLE_MAIL=yes (Mail is disabled) ; Skipping sending mail`));
            return [null, 'Sending mail is disabled'];
        } else {
            const status = await sgMail.send(msg);
            return [null, null, status];
        }
    } catch (e) {
        logger.error(e);
        return [e];
    }
};

module.exports = {
    sendMail
};
