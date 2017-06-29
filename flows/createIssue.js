'use strict'

const JiraApi = require('jira-client')
// const fetchIssue = require('./fetchIssue')
const components = require('./components')

if (process.env.JIRA_URL.startsWith('https://')) {
  process.env.JIRAHOST = process.env.JIRA_URL.substring(8)
  if (process.env.JIRAHOST.endsWith('\\')) {
    process.env.JIRAHOST.slice(0, -1)
  }
}

// var jira = new JiraApi({
//   protocol: 'https',
//   host: process.env.JIRAHOST,
//   username: process.env.JIRA_U,
//   password: process.env.JIRA_P,
//   apiVersion: '2',
//   strictSSL: true
// })

const HANDLE_FEATURE_INIT = 'feature:init'
const HANDLE_FEATURE_CUSTOMER_YN = 'feature:customeryn'
const HANDLE_FEATURE_CUSTOMER_NAME = 'feature:customername'
const HANDLE_FEATURE_COMPONENT = 'feature:component'
const HANDLE_FEATURE_PRIORITY = 'feature:priority'
const HANDLE_FEATURE_CONFIRM = 'feature:confirm'
// const TIMEOFF_DATE_FINISHED = 'timeoff:finished'
// const TIMEOFF_DATE_AUTHORIZE = 'timeoff:authorize'

const featureInit = (msg) => {
  msg.say({
    text: ``,
    attachments: [{
      text: `Hi! I see you want to create a Feature. Is this correct?`,
      fallback: 'Are you sure?',
      callback_id: HANDLE_FEATURE_INIT,
      actions: [
        {name: 'answer', style: 'primary', text: 'Yes', type: 'button', value: 'yes'},
        {name: 'answer', text: 'No', type: 'button', value: 'no'}
      ]
    }],
    channel: msg.body.user_id,
    as_user: true
  })
    .route(HANDLE_FEATURE_INIT)
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

  slapp.action(HANDLE_FEATURE_INIT, (msg) => {
    const state = {
      init: Date.now(),
      customer: null,
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

    msg.say({
      text: ``,
      attachments: [{
        text: `Is this for a Customer?`,
        fallback: `Is this for a Customer?`,
        callback_id: HANDLE_FEATURE_CUSTOMER_YN,
        actions: [
          {name: 'answer', style: 'primary', text: 'Yes', type: 'button', value: 'yes'},
          {name: 'answer', text: 'No', type: 'button', value: 'no'}
        ]
      }]
    })
      .route(HANDLE_FEATURE_CUSTOMER_YN, state, 20)
  })

  slapp.route(HANDLE_FEATURE_CUSTOMER_YN, (msg, state) => {
    let answer = msg.body.actions[0].value
    if (answer === 'no') {
      msg.respond({
        text: 'Which component?',
        callback_id: HANDLE_FEATURE_CUSTOMER_NAME,
        delete_original: true,
        attachments: [
          {
            text: '',
            fallback: '',
            callback_id: HANDLE_FEATURE_INIT,
            actions: components.getComponentButtons()
          }
        ]
      })
        .route(HANDLE_FEATURE_COMPONENT, state, 20)
    } else {
      msg.respond({
        text: `What is the Customer name?`,
        callback_id: HANDLE_FEATURE_CUSTOMER_NAME,
        delete_original: true
      })
        .route(HANDLE_FEATURE_CUSTOMER_NAME, state, 20)
    }
  })

  slapp.route(HANDLE_FEATURE_CUSTOMER_NAME, (msg, state) => {
    state.customer = msg.body.event.text.trim()
    msg.say({
      text: '',
      callback_id: HANDLE_FEATURE_COMPONENT,
      delete_original: true,
      attachments: [{
        text: 'Which component?',
        fallback: '',
        callback_id: HANDLE_FEATURE_INIT,
        actions: components.getComponentButtons()
      }]
    })
      .route(HANDLE_FEATURE_COMPONENT, state, 20)
  })

  slapp.route(HANDLE_FEATURE_COMPONENT, (msg, state) => {
    state.component = msg.body.actions[0].value
    const owner = components.getComponentOwner(state.component)
    const criticalButtonText = state.customer ? 'Churn Risk!' : 'Critical'
    const promptText = state.customer ? `What is the Priority for ${state.customer}?` : `What is the Priority?`
    msg.respond({
      text: `${owner} is going to be thrilled to hear about a new feature request from ${state.customer}!`,
      delete_original: true,
      attachments: [{
        text: promptText,
        callback_id: HANDLE_FEATURE_PRIORITY,
        actions: [
          { name: 'answer', text: criticalButtonText, type: 'button', value: 'Critical' },
          { name: 'answer', text: 'High', type: 'button', value: 'High' },
          { name: 'answer', text: 'Medium', type: 'button', value: 'Medium' },
          { name: 'answer', text: 'Low', type: 'button', value: 'Low' }
        ]
      }]
    })
      .route(HANDLE_FEATURE_PRIORITY, state, 20)
  })

  slapp.route(HANDLE_FEATURE_PRIORITY, (msg, state) => {
    state.priority = msg.body.actions[0].value
      // msg.say({
      //   text: `You've requested *${moment(state.start).format('MMM D, YYYY')}* to *${moment(state.end).format('MMM D, YYYY')}* off. Is this correct?`,
      //   attachments: [{
      //     text: '',
      //     callback_id: FEATURE_CONFIRM,
      //     actions: [
      //       {name: 'answer', style: 'primary', text: 'Yes', type: 'button', value: 'yes'},
      //       {name: 'answer', style: 'danger', text: 'No', type: 'button', value: 'no'}
      //     ]
      //   }]
      // })
      .route(HANDLE_FEATURE_CONFIRM, state, 20)
  })

  slapp.route(HANDLE_FEATURE_CONFIRM, (msg, state) => {
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

// const message = {
//   text: 'Which component?',
//   callback_id: FEATURE_CUSTOMER,
//   delete_original: true,
//   attachments: [
//     {
//       text: '',
//       fallback: '',
//       callback_id: FEATURE_INIT,
//       actions: components.getComponentButtons()
//     }
//   ]
// }
