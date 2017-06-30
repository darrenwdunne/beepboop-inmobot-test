'use strict'

const JiraApi = require('jira-client')
const fetchIssue = require('./fetchIssue')
const components = require('./components')
const jiraUtils = require('./jiraUtils')

if (process.env.JIRA_URL.startsWith('https://')) {
  process.env.JIRAHOST = process.env.JIRA_URL.substring(8)
  if (process.env.JIRAHOST.endsWith('\\')) {
    process.env.JIRAHOST.slice(0, -1)
  }
}

var jira = new JiraApi({
  protocol: 'https',
  host: process.env.JIRAHOST,
  username: process.env.JIRA_U,
  password: process.env.JIRA_P,
  apiVersion: '2',
  strictSSL: true
})

const HANDLE_FEATURE_INIT = 'feature:init'
const HANDLE_FEATURE_CUSTOMER_YN = 'feature:customeryn'
const HANDLE_FEATURE_CUSTOMER_NAME = 'feature:customername'
const HANDLE_FEATURE_COMPONENT = 'feature:component'
const HANDLE_FEATURE_PRIORITY = 'feature:priority'
const HANDLE_FEATURE_CONFIRM = 'feature:confirm'
const HANDLE_FEATURE_SUMMARY = 'feature:summary'
const HANDLE_FEATURE_DESCRIPTION = 'feature:description'
// const TIMEOFF_DATE_FINISHED = 'timeoff:finished'
// const TIMEOFF_DATE_AUTHORIZE = 'timeoff:authorize'

const featureInit = (msg) => {
  msg._slapp.client.users.info({token: msg.meta.bot_token, user: msg.meta.user_id}, (err, result) => {
    if (err) {
      console.log(err)
    }
    console.log(result.user.profile) // incl. first_name real_name real_name_normalized email
    msg.say({
      text: ``,
      attachments: [{
        text: `Hi ${result.user.profile.first_name}, I see you want to create a Feature. Is this correct?`,
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
  })
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
      init: Date.now()
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
      .say({
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
      .route(HANDLE_FEATURE_CUSTOMER_YN, state, 60)
  })

  slapp.route(HANDLE_FEATURE_CUSTOMER_YN, (msg, state) => {
    let answer = msg.body.actions[0].value
    if (answer === 'no') {
      msg.respond({
        text: 'Which component?',
        callback_id: HANDLE_FEATURE_CUSTOMER_NAME,
        delete_original: true,
        attachments: [{
          text: '',
          fallback: '',
          callback_id: HANDLE_FEATURE_INIT,
          actions: components.getComponentButtons()
        }]
      })
        .route(HANDLE_FEATURE_COMPONENT, state, 60)
    } else {
      msg.respond({
        text: `What is the Customer name?`,
        callback_id: HANDLE_FEATURE_CUSTOMER_NAME,
        delete_original: true
      })
        .route(HANDLE_FEATURE_CUSTOMER_NAME, state, 60)
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
      .route(HANDLE_FEATURE_COMPONENT, state, 60)
  })

  slapp.route(HANDLE_FEATURE_COMPONENT, (msg, state) => {
    state.component = msg.body.actions[0].value
    const owner = components.getComponentOwner(state.component)
    const criticalButtonText = state.customer ? 'Churn Risk!' : 'Critical'
    const promptText = state.customer ? `What is the Priority for ${state.customer}?` : `What is the Priority?`
    msg.respond({
      text: state.customer ? `${owner} is going to be thrilled to hear about a new ${state.component} feature request from ${state.customer}!` : `${owner} is going to be thrilled to hear about a new ${state.component} feature request!`,
      delete_original: true,
      attachments: [{
        text: promptText,
        callback_id: HANDLE_FEATURE_PRIORITY,
        actions: [
          { name: 'answer', text: criticalButtonText + jiraUtils.getPriorityLabel('Critical'), type: 'button', value: 'Critical' },
          { name: 'answer', text: jiraUtils.getPriorityLabel('High', true), type: 'button', value: 'High' },
          { name: 'answer', text: jiraUtils.getPriorityLabel('Medium', true), type: 'button', value: 'Medium' },
          { name: 'answer', text: jiraUtils.getPriorityLabel('Low', true), type: 'button', value: 'Low' }
        ]
      }]
    })
      .route(HANDLE_FEATURE_PRIORITY, state, 60)
  })

  slapp.route(HANDLE_FEATURE_PRIORITY, (msg, state) => {
    state.priority = msg.body.actions[0].value
    msg.respond({
      text: `Give me a one-line Summary:`,
      callback_id: HANDLE_FEATURE_SUMMARY,
      delete_original: true
    })
      .route(HANDLE_FEATURE_SUMMARY, state, 60)
  })

  slapp.route(HANDLE_FEATURE_SUMMARY, (msg, state) => {
    state.summary = msg.body.event.text.trim()
    msg.say({ // Note: this one needs to be a .say, not .respond?
      text: 'Enter the Description (hit `Shift-Enter` for multiple lines, `Enter` when done)',
      callback_id: HANDLE_FEATURE_DESCRIPTION,
      delete_original: true
    })
      .route(HANDLE_FEATURE_DESCRIPTION, state, 60)
  })

  slapp.route(HANDLE_FEATURE_DESCRIPTION, (msg, state) => {
    state.description = msg.body.event.text.trim()

    // get the user's real name from Slack (userid is available somewhere down in msg.body, but we want a friendly name
    slapp.client.users.info({token: msg.meta.bot_token, user: msg.meta.user_id}, (err, result) => {
      if (err) {
        console.log(err)
      }
      state.userProfile = result.user.profile // incl. first_name real_name real_name_normalized email

      msg.say({
        text: "Here's the feature I'm going to create. If it looks good, click Create",
        attachments: [{
          text: '',
          fallback: '',
          callback_id: HANDLE_FEATURE_CONFIRM,
          delete_original: true,
          actions: [
            { name: 'answer', text: 'Create', style: 'primary', type: 'button', value: 'create' },
            { name: 'answer', text: 'Cancel', style: 'danger', type: 'button', value: 'cancel' }
          ],
          fields: [{title: 'Summary', value: state.summary, short: false},
            {title: 'Customer', value: state.customer ? state.customer : 'None', short: true},
            {title: 'Requester', value: state.userProfile.real_name, short: true},
            {title: 'Priority', value: jiraUtils.getPriorityLabel(state.priority, true), short: true},
            {title: 'Component', value: state.component, short: true},
            {title: 'Description', value: state.description, short: false}
          ]

        }]
      })
        .route(HANDLE_FEATURE_CONFIRM, state, 60)
    })
  })

  slapp.route(HANDLE_FEATURE_CONFIRM, (msg, state) => {
    const isCorrect = msg.body.actions[0].value === 'create'

    if (!isCorrect) {
      msg.respond(msg.body.response_url, {text: 'Feature creation cancelled.'})
      return
    }

    msg.respond(msg.body.response_url, {text: 'Creating...'})
    createIssueInJIRA(msg, state)
  })
}

// function getFeatureCreationSummaryText (state) {
//   var text = "Here's the feature I'm going to create:\n\n*Summary:* " + state.summary
//   if (state.customerName !== undefined && state.customerName !== '') {
//     text += '\n*Customer:* ' + state.customerName
//   }
//   text += '\n*Component:* ' + state.component + '\n*Priority:* ' + state.priority + '\n*Description:*\n' + state.description
//   return text
// }

function buildCustomerLabel (customerName) {
  var newStr = 'account-' + customerName.replace(/ /g, '').replace(/-/, '').replace(/'/, '').toLowerCase()
  return newStr
}

function getLabelArray (state) {
  var labelArray = []
  if (state.customerName !== undefined) {
    labelArray.push(buildCustomerLabel(state.customerName))
  }
  labelArray.push(components.getComponentLabel(state.component))
  labelArray.push('inmobot')
  return labelArray
}

function createIssueInJIRA (msg, state) {
  // get the user's user.name in JIRA (given the email address they're using on Slack)
  jira.searchUsers({
    username: state.userProfile.email
  })
    .then(jiraUser => {
      // user had Slack access, but not JIRA access
      if (jiraUser.length > 0) {
        state.jiraUserName = jiraUser[0].name
      } else {
        console.log(`No JIRA user name found for ${state.userProfile.email}`)
        state.jiraUserName = 'Ddunne' // TODO: how about just don't pass anything along?
      }

      jira.addNewIssue({
        fields: {
          project: {key: 'DWD'}, // TODO: change to CLW
          issuetype: {name: 'Task'},
          summary: state.summary,
          description: state.description + '\n\n----\n\n??(*g) Created by inMoBot on behalf of ' + state.userProfile.real_name + '??',
          assignee: {name: components.getComponentOwnerJiraId(state.component)},
          reporter: {name: state.jiraUserName},
          priority: {name: state.priority},
          labels: getLabelArray(state)
        }
      })
        .then(issue => {
          msg.respond(msg.body.response_url, { text: 'Here is your JIRA feature:', delete_original: true }) // remove the "Creating" text
          // msg.say('Here is your JIRA feature:')
          fetchIssue.outputMessage(msg, issue.key, '', '')
        })
        .catch(error => {
          console.log(error.message)
        })
    })
}
