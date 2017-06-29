'use strict'
const moment = require('moment-timezone')
const config = {
  timezone: 'America/Los_Angeles'
}

const TIMEOFF_INIT = 'timeoff:init'
const TIMEOFF_DATE_START = 'timeoff:startDate'
const TIMEOFF_DATE_END = 'timeoff:endDate'
const TIMEOFF_REASON = 'timeoff:reason'
const TIMEOFF_DATE_CONFIRM = 'timeoff:confirm'
// const TIMEOFF_DATE_FINISHED = 'timeoff:finished'
const TIMEOFF_DATE_AUTHORIZE = 'timeoff:authorize'

const timeoffInit = (msg) => {
  const message = {
    text: ``,
    attachments: [
      {
        text: `I see you want to take some time off. Is this correct?`,
        fallback: 'Are you sure?',
        callback_id: TIMEOFF_INIT,
        actions: [
          {name: 'answer', style: 'primary', text: 'Yes', type: 'button', value: 'yes'},
          {name: 'answer', text: 'No', type: 'button', value: 'no'}
        ]
      }
    ],
    channel: msg.body.user_id,
    as_user: true
  }

  msg
    .say(message)
    .route(TIMEOFF_INIT)
}

module.exports = (slapp) => {
  slapp.use((msg, next) => {
    if (msg.type === 'command') {
      if (msg.body.command.trim() === '/timeoff') {
        timeoffInit(msg)
        return
      }
    }
    next()
  })

  slapp.command('/timeoff', /.*/, timeoffInit)

  slapp.action(TIMEOFF_INIT, (msg) => {
    const state = {
      init: Date.now(),
      start: null,
      end: null,
      reason: '',
      user: msg.body.user
    }

    const message = {
      text: '1 of 3. `Starting when`? _(Format: YYYY-MM-DD)_',
      callback_id: TIMEOFF_DATE_START,
      delete_original: true
    }

    let answer = msg.body.actions[0].value
    if (answer !== 'yes') {
      msg.respond(msg.body.response_url, {
        text: `Glad you to have you around!`,
        delete_original: true
      })

      return
    }

    msg.respond(msg.body.response_url, {
      text: `Starting timeoff request. You can restart at any time with the \`/timeoff\` command.`,
      delete_original: true
    })

    msg
      .say(message)
      .route(TIMEOFF_DATE_START, state, 20)
  })

  slapp.route(TIMEOFF_DATE_START, (msg, state) => {
    const start = moment(msg.body.event.text.trim()).tz(config.timezone)
    state.start = start.toDate()
    const message = {
      text: `2 of 3. Starting from *${start.format('MMM D, YYYY')}* \`until when\`? _(Format: YYYY-MM-DD)_`,
      callback_id: TIMEOFF_DATE_END
    }

    msg
      .say(message)
      .route(TIMEOFF_DATE_END, state, 20)
  })

  slapp.route(TIMEOFF_DATE_END, (msg, state) => {
    const end = moment(msg.body.event.text.trim()).tz(config.timezone)
    state.end = end.toDate()
    const message = {
      text: `3 of 3. \`Why\` do you need *${moment(state.start).format('MMM D, YYYY')}* to *${end.format('MMM D, YYYY')}* off?`,
      callback_id: TIMEOFF_REASON
    }

    msg
      .say(message)
      .route(TIMEOFF_REASON, state, 60)
  })

  slapp.route(TIMEOFF_REASON, (msg, state) => {
    state.reason = msg.body.event.text.trim()
    const message = {
      text: `You've requested *${moment(state.start).format('MMM D, YYYY')}* to *${moment(state.end).format('MMM D, YYYY')}* off. Is this correct?`,
      attachments: [
        {
          text: '',
          callback_id: TIMEOFF_DATE_CONFIRM,
          actions: [
            {name: 'answer', style: 'primary', text: 'Yes', type: 'button', value: 'yes'},
            {name: 'answer', style: 'danger', text: 'No', type: 'button', value: 'no'}
          ]
        }
      ]
    }

    msg
      .say(message)
      .route(TIMEOFF_DATE_CONFIRM, state, 20)
  })

  slapp.route(TIMEOFF_DATE_CONFIRM, (msg, state) => {
    const isCorrect = msg.body.actions[0].value === 'yes'

    if (!isCorrect) {
      msg.respond(msg.body.response_url, {text: 'Timeoff request cancelled.'})
      return
    }

    const no = Object.assign({}, state, {answer: 'no'})
    const yes = Object.assign({}, state, {answer: 'yes'})
    msg.respond(msg.body.response_url, {text: 'Your request has been submitted.'})

    const message = {
      text: `<@${state.user.id}|${state.user.name}> has requested *${moment(state.start).format('MMM D, YYYY')}* to *${moment(state.end).format('MMM D, YYYY')}* off with reason:
\`\`\`
${state.reason}
\`\`\`
      `,
      channel: 'personnel',
      // channel: 'utilities-test',
      as_user: true,
      attachments: [
        {
          text: '',
          callback_id: TIMEOFF_DATE_AUTHORIZE,
          actions: [
            {name: 'answer', text: 'Approve', style: 'primary', type: 'button', value: JSON.stringify(yes)},
            {name: 'answer', text: 'Deny', style: 'danger', type: 'button', value: JSON.stringify(no)}
          ]
        }
      ]
    }
    msg
      .say(message)
  })

  slapp.action(TIMEOFF_DATE_AUTHORIZE, (msg, answer) => {
    const state = JSON.parse(answer)
    const message = {
      text: '',
      attachments: [
        {
          text: `<@${state.user.id}|${state.user.name}> has requested ${moment(state.start).format('MMM D, YYYY')} to ${moment(state.end).format('MMM D, YYYY')} off for:
${state.reason}
          `,
          color: 'good'
        }
      ],
      delete_original: true,
      channel: msg.body.channel.id,
      as_user: true,
      response_type: 'in_channel'
    }

    if (state.answer === 'yes') {
      message.text = `Time off request has been approved by <@${msg.body.user.id}|${msg.body.user.name}>`
    } else {
      message.text = `Time off request has been denied by <@${msg.body.user.id}|${msg.body.user.name}>`
      message.attachments[0].color = 'danger'
    }

    msg.respond(msg.body.response_url, message)

    const timeoffMessage = {
      text: message.text,
      attachments: message.attachments,
      channel: state.user.id,
      as_user: true
    }

    msg.say(timeoffMessage)
  })
}
