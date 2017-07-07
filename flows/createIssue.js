'use strict'

const JiraApi = require('jira-client')
const fetchIssue = require('./fetchIssue')
const components = require('./../components')
const jiraUtils = require('./../jiraUtils')

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

const HANDLE_INIT = 'HANDLE_INIT'
const HANDLE_ACCOUNT_YN = 'HANDLE_ACCOUNT_YN'
const HANDLE_ACCOUNT_NAME = 'HANDLE_ACCOUNT_NAME'
const HANDLE_ACCOUNT_SELECT = 'HANDLE_ACCOUNT_SELECT'
const HANDLE_COMPONENT = 'HANDLE_COMPONENT'
const HANDLE_PRIORITY = 'HANDLE_PRIORITY'
const HANDLE_CONFIRM = 'HANDLE_CONFIRM'
const HANDLE_SUMMARY = 'HANDLE_SUMMARY'
const HANDLE_DESCRIPTION = 'HANDLE_DESCRIPTION'

const featureInit = (msg) => {
  msg._slapp.client.users.info({token: msg.meta.bot_token, user: msg.meta.user_id}, (err, result) => {
    if (err) {
      console.log(err)
    }
    // console.log(result.user.profile) // incl. first_name real_name real_name_normalized email
    msg.say({
      text: ``,
      attachments: [{
        text: `Hi ${result.user.profile.first_name}, I see you want to create a Feature. Is this correct?`,
        callback_id: HANDLE_INIT,
        actions: [
          {name: 'answer', style: 'primary', text: 'Yes', type: 'button', value: 'yes'},
          {name: 'answer', text: 'No', type: 'button', value: 'no'}
        ]
      }],
      channel: msg.body.user_id,
      as_user: true
    })
      .route(HANDLE_INIT)
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

  slapp.action(HANDLE_INIT, (msg) => {
    const state = {
      init: Date.now()
    }

    let answer = msg.body.actions[0].value
    if (answer !== 'yes') {
      msg.respond(msg.body.response_url, {text: 'A day may come when we create a Feature, but *_It Is Not This Day!_* :crossed_swords:',
        delete_original: true
      })
      return
    }

    msg.respond(msg.body.response_url, {text: `Starting feature request. You can restart at any time with the \`/feature\` command.`,
      delete_original: true
    })
      .say({
        text: ``,
        attachments: [{
          text: `Is this for an Account?`,
          callback_id: HANDLE_ACCOUNT_YN,
          actions: [
            {name: 'answer', style: 'primary', text: 'Existing Account', type: 'button', value: 'existing'},
            {name: 'answer', text: 'Prospective Account', type: 'button', value: 'prospect'},
            {name: 'answer', text: 'No', type: 'button', value: 'no'}
          ]
        }]
      })
      .route(HANDLE_ACCOUNT_YN, state, 60)
  })

  slapp.route(HANDLE_ACCOUNT_YN, (msg, state) => {
    let answer = msg.body.actions[0].value
    switch (answer) {
      case 'no':
        msg.respond({text: 'Which component?',
          callback_id: HANDLE_COMPONENT,
          delete_original: true,
          attachments: [{
            text: '',
            callback_id: HANDLE_INIT,
            actions: components.getComponentButtons()
          }]
        })
          .route(HANDLE_COMPONENT, state, 60)
        break
      case 'existing':
        msg.respond({text: `Type a few characters of the Account name, so I can give you a list to choose from`,
          callback_id: HANDLE_ACCOUNT_NAME,
          delete_original: true
        })
          .route(HANDLE_ACCOUNT_NAME, state, 60)
        break
      case 'prospect':
        msg.respond({text: `Type the Prospective Account name`,
          callback_id: HANDLE_ACCOUNT_NAME,
          delete_original: true
        })
          .route(HANDLE_ACCOUNT_NAME, state, 60)
        break
// FIXME: here
    }

    }
  })

  slapp.route(HANDLE_ACCOUNT_NAME, (msg, state) => {
    // they just gave us a few characters
    state.accountshortname = msg.body.event.text.trim()
    const searchResults = jiraUtils.searchAccounts(state.accountshortname)
    const optionsArray = jiraUtils.buildAccountsOptionsArray(searchResults)

    msg.say({text: '',
      delete_original: true,
      response_type: 'ephemeral',
      replace_original: true,
      attachments: [{
        text: 'Which specific Account?',
        callback_id: HANDLE_ACCOUNT_SELECT,
        actions: [
          {
            'name': 'accounts_list',
            'text': 'Select the Account',
            'type': 'select',
            'options': optionsArray
          }
        ]
      }]
    })
      .route(HANDLE_ACCOUNT_SELECT, state, 60)
  })

  slapp.route(HANDLE_ACCOUNT_SELECT, (msg, state) => {
    state.accountName = msg.body.actions[0].selected_options[0].value
    msg.respond({text: '',
      callback_id: HANDLE_COMPONENT,
      delete_original: true,
      attachments: [{
        text: 'Which component?',
        callback_id: HANDLE_INIT,
        actions: components.getComponentButtons()
      }]
    })
      .route(HANDLE_COMPONENT, state, 60)
  })

  slapp.route(HANDLE_COMPONENT, (msg, state) => {
    state.component = msg.body.actions[0].value
    const owner = components.getComponentOwner(state.component)
    const criticalButtonText = state.accountName ? 'Churn Risk!' : 'Critical'
    const promptText = state.accountName ? `What is the Priority for ${state.accountName}?` : `What is the Priority?`
    msg.respond({
      text: state.accountName ? `${owner} is going to be thrilled to hear about a new ${state.component} feature request from ${state.accountName}!` : `${owner} is going to be thrilled to hear about a new ${state.component} feature request!`,
      delete_original: true,
      attachments: [{
        text: promptText,
        callback_id: HANDLE_PRIORITY,
        actions: [
          { name: 'answer', text: criticalButtonText + jiraUtils.getPriorityLabel('Critical'), type: 'button', value: 'Critical' },
          { name: 'answer', text: jiraUtils.getPriorityLabel('High', true), type: 'button', value: 'High' },
          { name: 'answer', text: jiraUtils.getPriorityLabel('Medium', true), type: 'button', value: 'Medium' },
          { name: 'answer', text: jiraUtils.getPriorityLabel('Low', true), type: 'button', value: 'Low' }
        ]
      }]
    })
      .route(HANDLE_PRIORITY, state, 60)
  })

  slapp.route(HANDLE_PRIORITY, (msg, state) => {
    state.priority = msg.body.actions[0].value
    msg.respond({
      text: `Give me a one-line Summary:`,
      callback_id: HANDLE_SUMMARY,
      delete_original: true
    })
      .route(HANDLE_SUMMARY, state, 60)
  })

  slapp.route(HANDLE_SUMMARY, (msg, state) => {
    state.summary = msg.body.event.text.trim()
    msg.say({ // Note: this one needs to be a .say, not .respond?
      text: 'Enter the Description (hit `Shift-Enter` for multiple lines, `Enter` when done)',
      callback_id: HANDLE_DESCRIPTION,
      delete_original: true
    })
      .route(HANDLE_DESCRIPTION, state, 60)
  })

  slapp.route(HANDLE_DESCRIPTION, (msg, state) => {
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
          callback_id: HANDLE_CONFIRM,
          delete_original: true,
          actions: [
            { name: 'answer', text: 'Create', style: 'primary', type: 'button', value: 'create' },
            { name: 'answer', text: 'Cancel', style: 'danger', type: 'button', value: 'cancel' }
          ],
          fields: [{title: 'Summary', value: state.summary, short: false},
            {title: 'Account', value: state.accountName ? state.accountName : 'None', short: true},
            {title: 'Requester', value: state.userProfile.real_name, short: true},
            {title: 'Priority', value: jiraUtils.getPriorityLabel(state.priority, true), short: true},
            {title: 'Component', value: state.component, short: true},
            {title: 'Description', value: state.description, short: false}
          ]

        }]
      })
        .route(HANDLE_CONFIRM, state, 60)
    })
  })

  slapp.route(HANDLE_CONFIRM, (msg, state) => {
    const isCorrect = msg.body.actions[0].value === 'create'

    if (!isCorrect) {
      msg.respond(msg.body.response_url, {text: 'Feature creation cancelled.'})
      return
    }

    msg.respond(msg.body.response_url, {text: 'Creating...'})
    createIssueInJIRA(msg, state)
  })
}

function buildAccountLabel (accountName) {
  var newStr = 'account-' + accountName.replace(/ /g, '').replace(/-/, '').replace(/'/, '').toLowerCase()
  return newStr
}

function getLabelArray (state) {
  var labelArray = []
  if (state.accountName) {
    labelArray.push(buildAccountLabel(state.accountName))
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
      var fields = {
        project: {key: process.env.JIRA_FEATURE_PROJECT_PREFIX},
        issuetype: {name: 'Task'},
        summary: state.summary,
        description: state.description + '\n\n----\n\n??(*g) Created by inMoBot on behalf of ' + state.userProfile.real_name + '??',
        assignee: {name: components.getComponentOwnerJiraId(state.component)},
        priority: {name: state.priority},
        labels: getLabelArray(state)
      }
      if (jiraUser.length > 0) {
        state.jiraUserName = jiraUser[0].name
        fields.reporter = {name: state.jiraUserName}
      } else {
        // user had Slack access, but not JIRA access. don't set fields.reporter (inMoBot will just use the userid in the .env)
        console.log(`Warning: No JIRA user name found for ${state.userProfile.email}`)
      }

      jira.addNewIssue({
        fields: fields
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
