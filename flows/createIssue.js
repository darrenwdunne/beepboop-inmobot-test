'use strict'
const moment = require('moment-timezone')
const config = {
  timezone: 'America/Los_Angeles'
}

const JiraApi = require('jira-client')
// const fetchIssue = require('./fetchIssue')
const components = require('./components')

if (process.env.JIRA_URL.startsWith('https://')) {
  process.env.JIRAHOST = process.env.JIRA_URL.substring(8)
  if (process.env.JIRAHOST.endsWith('\\')) {
    process.env.JIRAHOST.slice(0, -1)
  }
}

// console.log('process.env.JIRAHOST=[' + process.env.JIRAHOST + ']')

var jira = new JiraApi({
  protocol: 'https',
  host: process.env.JIRAHOST,
  username: process.env.JIRA_U,
  password: process.env.JIRA_P,
  apiVersion: '2',
  strictSSL: true
})

const FEATURE_INIT = 'feature:init'
const FEATURE_CUSTOMER = 'feature:customer'
const FEATURE_COMPONENT = 'feature:component'
const FEATURE_PRIORITY = 'feature:priority'
const FEATURE_CONFIRM = 'feature:confirm'
// const TIMEOFF_DATE_FINISHED = 'timeoff:finished'
// const TIMEOFF_DATE_AUTHORIZE = 'timeoff:authorize'

const featureInit = (msg) => {
  const message = {
    text: ``,
    attachments: [
      {
        text: `Hi! I see you want to create an Feature. Is this correct?`,
        fallback: 'Are you sure?',
        callback_id: FEATURE_INIT,
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
    .route(FEATURE_INIT)
}

module.exports = (slapp) => {
  slapp.use((msg, next) => {
    if (msg.type === 'command') {
      if (msg.body.command.trim() === '/feature') {
        featureInit(msg)
        return
      }
    }
    next()
  })

  slapp.command('/feature', /.*/, featureInit)

  slapp.action(FEATURE_INIT, (msg) => {
    const state = {
      init: Date.now(),
      start: null,
      end: null,
      reason: '',
      user: msg.body.user
    }

    let answer = msg.body.actions[0].value
    if (answer !== 'yes') {
      msg.respond(msg.body.response_url, {
        text: 'A day may come when we create a Feature, but *_It Is Not This Day!_* :crossed_swords:',
        delete_original: true
      })
      return
    }

    msg.respond(msg.body.response_url, {
      text: `Starting feature request. You can restart at any time with the \`/feature\` command.`,
      delete_original: true
    })

    const message = {
      text: 'Which component?',
      callback_id: FEATURE_CUSTOMER,
      delete_original: true,
      attachments: [
        {
          text: '',
          fallback: '',
          callback_id: FEATURE_INIT,
          actions: components.getComponentButtons()
        }
      ]
    }

    msg
      .say(message)
      .route(FEATURE_CUSTOMER, state, 20)
  })

  slapp.route(FEATURE_CUSTOMER, (msg, state) => {
    const answer = msg.body.actions[0].value
    const owner = components.getComponentOwner(answer)
    msg.respond({
      text: `${owner} is going to be thrilled to hear about your new ${answer} feature!`, 
      delete_original: true
    })

    const message = { // TODO: change this to "is there a customer?" (because you can't hit Enter on an empty slack message)
      text: 'Who is the customer? Just hit `Enter` if there is no customer.',
      callback_id: FEATURE_COMPONENT
    }

    msg
      .say(message)
      .route(FEATURE_COMPONENT, state, 20)
  })

  slapp.route(FEATURE_COMPONENT, (msg, state) => {
    // const end = moment(msg.body.event.text.trim()).tz(config.timezone)
    // state.end = end.toDate()
    const message = {
      text: `3 of 3. \`Why\`?`,
      callback_id: FEATURE_PRIORITY
    }

    msg
      .say(message)
      .route(FEATURE_PRIORITY, state, 60)
  })

  slapp.route(FEATURE_PRIORITY, (msg, state) => {
    state.reason = msg.body.event.text.trim()
    const message = {
      text: `You've requested *${moment(state.start).format('MMM D, YYYY')}* to *${moment(state.end).format('MMM D, YYYY')}* off. Is this correct?`,
      attachments: [
        {
          text: '',
          callback_id: FEATURE_CONFIRM,
          actions: [
            {name: 'answer', style: 'primary', text: 'Yes', type: 'button', value: 'yes'},
            {name: 'answer', style: 'danger', text: 'No', type: 'button', value: 'no'}
          ]
        }
      ]
    }

    msg
      .say(message)
      .route(FEATURE_CONFIRM, state, 20)
  })

  slapp.route(FEATURE_CONFIRM, (msg, state) => {
    const isCorrect = msg.body.actions[0].value === 'yes'

    if (!isCorrect) {
      msg.respond(msg.body.response_url, {text: 'Timeoff request cancelled.'})
      return
    }

    const no = Object.assign({}, state, {answer: 'no'})
    const yes = Object.assign({}, state, {answer: 'yes'})
    msg.respond(msg.body.response_url, {text: 'Your request has been submitted.'})

  //     const message = {
  //       text: `<@${state.user.id}|${state.user.name}> has requested *${moment(state.start).format('MMM D, YYYY')}* to *${moment(state.end).format('MMM D, YYYY')}* off with reason:
  // \`\`\`
  // ${state.reason}
  // \`\`\`
  //       `,
  //       channel: 'personnel',
  //       // channel: 'utilities-test',
  //       as_user: true,
  //       attachments: [
  //         {
  //           text: '',
  //           callback_id: TIMEOFF_DATE_AUTHORIZE,
  //           actions: [
  //             {name: 'answer', text: 'Approve', style: 'primary', type: 'button', value: JSON.stringify(yes)},
  //             {name: 'answer', text: 'Deny', style: 'danger', type: 'button', value: JSON.stringify(no)}
  //           ]
  //         }
  //       ]
  //     }
  //     msg
  //       .say(message)
  })

  //   slapp.action(TIMEOFF_DATE_AUTHORIZE, (msg, answer) => {
  //     const state = JSON.parse(answer)
  //     const message = {
  //       text: '',
  //       attachments: [
  //         {
  //           text: `<@${state.user.id}|${state.user.name}> has requested ${moment(state.start).format('MMM D, YYYY')} to ${moment(state.end).format('MMM D, YYYY')} off for:
  // ${state.reason}
  //           `,
  //           color: 'good'
  //         }
  //       ],
  //       delete_original: true,
  //       channel: msg.body.channel.id,
  //       as_user: true,
  //       response_type: 'in_channel'
  //     }

  //     if (state.answer === 'yes') {
  //       message.text = `Time off request has been approved by <@${msg.body.user.id}|${msg.body.user.name}>`
  //     } else {
  //       message.text = `Time off request has been denied by <@${msg.body.user.id}|${msg.body.user.name}>`
  //       message.attachments[0].color = 'danger'
  //     }

  //     msg.respond(msg.body.response_url, message)

  //     const timeoffMessage = {
  //       text: message.text,
  //       attachments: message.attachments,
  //       channel: state.user.id,
  //       as_user: true
  //     }

//     msg.say(timeoffMessage)
//   })
}
