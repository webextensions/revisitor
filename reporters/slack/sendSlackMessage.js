const { logger } = require('note-down');

const sendSlackMessage = async function ({ webhookUrl, message }) {
    // eslint-disable-next-line import/no-unresolved
    const { got } = await import('got');
    if (process.env.DISABLE_SLACK_WEBHOOK === 'yes') {
        return [null, 'DISABLE_SLACK_WEBHOOK=yes (Slack webhook is disabled) ; Skipping posting message to Slack'];
    } else {
        try {
            const response = await got.post(webhookUrl, {
                json: {
                    text: message
                },
                responseType: 'text'
            });
            return [null, null, response.body];
        } catch (e) {
            logger.error(e);
            return [e];
        }
    }
};

module.exports = {
    sendSlackMessage
};
