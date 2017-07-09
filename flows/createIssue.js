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
const HANDLE_ACCOUNT_TYPE = 'HANDLE_ACCOUNT_TYPE'
const HANDLE_ACCOUNT_NAME = 'HANDLE_ACCOUNT_NAME'
const HANDLE_ACCOUNT_SELECT = 'HANDLE_ACCOUNT_SELECT'
const HANDLE_COMPONENT = 'HANDLE_COMPONENT'
const HANDLE_SEGMENT = 'HANDLE_SEGMENT'
const HANDLE_PRIORITY = 'HANDLE_PRIORITY'
const HANDLE_CONFIRM = 'HANDLE_CONFIRM'
const HANDLE_SUMMARY = 'HANDLE_SUMMARY'
const HANDLE_DESCRIPTION = 'HANDLE_DESCRIPTION'

const ACCOUNT_TYPE_EXISTING = 'existing'
const ACCOUNT_TYPE_PROSPECT = 'prospect'
const ACCOUNT_TYPE_NONE = 'none'

const SEGMENT_UNKNOWN = `I don't know`

const featureInit = (msg) => {
  msg._slapp.client.users.info({ token: msg.meta.bot_token, user: msg.meta.user_id }, (err, result) => {
    if (err) {
      console.log(err)
    }
    // console.log(result.user.profile) // incl. first_name real_name real_name_normalized email
    msg
      .say({
        text: ``,
        attachments: [
          {
            text: `Hi ${result.user.profile.first_name}, I see you want to create a Feature. Is this correct?`,
            callback_id: HANDLE_INIT,
            actions: [ { name: 'answer', style: 'primary', text: 'Yes', type: 'button', value: 'yes' }, { name: 'answer', text: 'No', type: 'button', value: 'no' } ]
          }
        ],
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
      msg.respond(msg.body.response_url, {
        text: 'A day may come when we create a Feature, but *_It Is Not This Day!_* :crossed_swords:',
        delete_original: true
      })
      return
    }

    msg
      .respond(msg.body.response_url, {
        text: `Starting feature request. You can restart at any time with the \`/feature\` command.`,
        delete_original: true
      })
      .say({
        text: ``,
        attachments: [
          {
            text: `Is this for an Account?`,
            callback_id: HANDLE_ACCOUNT_TYPE,
            actions: [
              {
                name: 'answer',
                style: 'primary',
                text: 'Existing Account',
                type: 'button',
                value: ACCOUNT_TYPE_EXISTING
              },
              { name: 'answer', text: 'Prospective Account', type: 'button', value: ACCOUNT_TYPE_PROSPECT },
              { name: 'answer', text: 'No', type: 'button', value: ACCOUNT_TYPE_NONE }
            ]
          }
        ]
      })
      .route(HANDLE_ACCOUNT_TYPE, state, 60)
  })

  const COMPONENT_MSG = {
    text: '',
    callback_id: HANDLE_COMPONENT,
    delete_original: true,
    attachments: [
      {
        text: 'Which component?',
        callback_id: HANDLE_COMPONENT,
        actions: components.getComponentButtons()
      }
    ]
  }

  slapp.route(HANDLE_ACCOUNT_TYPE, (msg, state) => {
    let answer = msg.body.actions[0].value
    state.accountType = answer
    switch (answer) {
      case ACCOUNT_TYPE_NONE:
        msg.respond(COMPONENT_MSG).route(HANDLE_COMPONENT, state, 60)
        break
      case ACCOUNT_TYPE_EXISTING:
        msg
          .respond({
            text: `Type a few characters of the Account name, so I can give you a list to choose from`,
            callback_id: HANDLE_ACCOUNT_NAME,
            delete_original: true
          })
          .route(HANDLE_ACCOUNT_NAME, state, 60)
        break
      case ACCOUNT_TYPE_PROSPECT:
        msg
          .respond({
            text: `Type the Prospective Account name`,
            callback_id: HANDLE_ACCOUNT_SELECT,
            delete_original: true
          })
          .route(HANDLE_ACCOUNT_SELECT, state, 60) // skip over the account selection dropdown
        break
    }
  })

  slapp.route(HANDLE_ACCOUNT_NAME, (msg, state) => {
    var answer = msg.body.event.text.trim()
    if (!isQuitter(msg, answer)) {
      // they just gave us a few characters
      state.accountshortname = answer
      const searchResults = jiraUtils.searchAccounts(state.accountshortname)
      const optionsArray = jiraUtils.buildAccountsOptionsArray(searchResults)

      msg
        .say({
          text: '',
          delete_original: true,
          // response_type: 'ephemeral',
          // replace_original: true,
          attachments: [
            {
              text: 'Which specific Account?',
              callback_id: HANDLE_ACCOUNT_SELECT,
              actions: [
                {
                  name: 'accounts_list',
                  text: 'Select the Account',
                  type: 'select',
                  options: optionsArray
                }
              ]
            }
          ]
        })
        .route(HANDLE_ACCOUNT_SELECT, state, 60)
    }
  })

  function getSegmentButtons () {
    var segmentNames = jiraUtils.getSegmentsCache()
    var segmentButtons = []
    for (let i in segmentNames) {
      var cmp = { name: 'answer', text: segmentNames[i].value, type: 'button', value: segmentNames[i].value }
      segmentButtons.push(cmp)
    }
    segmentButtons.push({ name: 'answer', text: SEGMENT_UNKNOWN, type: 'button', value: SEGMENT_UNKNOWN })
    return segmentButtons
  }

  slapp.route(HANDLE_ACCOUNT_SELECT, (msg, state) => {
    switch (state.accountType) {
      case ACCOUNT_TYPE_PROSPECT:
        const answer = msg.body.event.text.trim()
        if (!isQuitter(msg, answer)) {
          state.accountName = msg.body.event.text.trim()
          // respond doesn't work here
          msg
            .say({
              text: '',
              callback_id: HANDLE_SEGMENT,
              delete_original: true,
              attachments: [
                {
                  text: 'Which segment?',
                  callback_id: HANDLE_SEGMENT,
                  actions: getSegmentButtons()
                }
              ]
            })
            .route(HANDLE_SEGMENT, state, 60)
        }
        break
      case ACCOUNT_TYPE_EXISTING:
        state.accountName = msg.body.actions[0].selected_options[0].value
        // here, we need to respond (not say) to make the select menu disappear
        msg
          .respond({
            text: '',
            callback_id: HANDLE_SEGMENT,
            delete_original: true,
            attachments: [
              {
                text: 'Which segment?',
                callback_id: HANDLE_SEGMENT,
                actions: getSegmentButtons()
              }
            ]
          })
          .route(HANDLE_SEGMENT, state, 60)
        break
      case ACCOUNT_TYPE_NONE:
        console.log(`Error: shouldn't get here with ACCOUNT_TYPE_NONE?`)
        break
    }
  })

  slapp.route(HANDLE_SEGMENT, (msg, state) => {
    state.segment = msg.body.actions[0].value // FIXME: if they just type text (not a button, reroute)
    // FIXME: isquitter
    msg.respond(COMPONENT_MSG).route(HANDLE_COMPONENT, state, 60)
  })

  slapp.route(HANDLE_COMPONENT, (msg, state) => {
    state.component = msg.body.actions[0].value // FIXME: if they just type text (not a button, reroute)
    const owner = components.getComponentOwner(state.component)
    const criticalButtonText = state.accountType === ACCOUNT_TYPE_EXISTING ? 'Churn Risk!' : 'Critical'
    const promptText = state.accountName ? `What is the Priority for ${state.accountName}?` : `What is the Priority?`
    msg
      .respond({
        text: state.accountName
          ? `${owner} is going to be thrilled to hear about a new ${state.component} feature request from ${state.accountName}!`
          : `${owner} is going to be thrilled to hear about a new ${state.component} feature request!`,
        delete_original: true,
        attachments: [
          {
            text: promptText,
            callback_id: HANDLE_PRIORITY,
            actions: [
              { name: 'answer', text: criticalButtonText + jiraUtils.getPriorityLabel('Critical'), type: 'button', value: 'Critical' },
              { name: 'answer', text: jiraUtils.getPriorityLabel('High', true), type: 'button', value: 'High' },
              { name: 'answer', text: jiraUtils.getPriorityLabel('Medium', true), type: 'button', value: 'Medium' },
              { name: 'answer', text: jiraUtils.getPriorityLabel('Low', true), type: 'button', value: 'Low' }
            ]
          }
        ]
      })
      .route(HANDLE_PRIORITY, state, 60)
  })

  slapp.route(HANDLE_PRIORITY, (msg, state) => {
    state.priority = msg.body.actions[0].value
    msg
      .respond({
        text: `Give me a one-line Summary:`,
        callback_id: HANDLE_SUMMARY,
        delete_original: true
      })
      .route(HANDLE_SUMMARY, state, 60)
  })

  slapp.route(HANDLE_SUMMARY, (msg, state) => {
    const answer = msg.body.event.text.trim()
    if (!isQuitter(msg, answer)) {
      state.summary = answer
      msg
        .say({
          // Note: this one needs to be a .say, not .respond?
          text: 'Enter the Description (hit `Shift-Enter` for multiple lines, `Enter` when done)',
          callback_id: HANDLE_DESCRIPTION,
          delete_original: true
        })
        .route(HANDLE_DESCRIPTION, state, 60)
    }
  })

  slapp.route(HANDLE_DESCRIPTION, (msg, state) => {
    const answer = msg.body.event.text.trim()
    if (!isQuitter(msg, answer)) {
      state.description = answer

      // get the user's real name from Slack (userid is available somewhere down in msg.body, but we want a friendly name
      slapp.client.users.info({ token: msg.meta.bot_token, user: msg.meta.user_id }, (err, result) => {
        if (err) {
          console.log(err)
        }
        state.userProfile = result.user.profile // incl. first_name real_name real_name_normalized email

        msg
          .say({
            text: "Here's the feature I'm going to create. If it looks good, click Create",
            attachments: [
              {
                text: '',
                callback_id: HANDLE_CONFIRM,
                delete_original: true,
                actions: [
                  { name: 'answer', text: 'Create', style: 'primary', type: 'button', value: 'create' },
                  { name: 'answer', text: 'Cancel', style: 'danger', type: 'button', value: 'cancel' }
                ],
                fields: [
                  { title: 'Summary', value: state.summary, short: false },
                  { title: 'Account', value: state.accountName ? state.accountName : 'None', short: true },
                  { title: 'Requester', value: state.userProfile.real_name, short: true },
                  { title: 'Priority', value: jiraUtils.getPriorityLabel(state.priority, true), short: true },
                  { title: 'Component', value: state.component, short: true },
                  { title: 'Description', value: state.description, short: false }
                ]
              }
            ]
          })
          .route(HANDLE_CONFIRM, state, 60)
      })
    }
  })

  slapp.route(HANDLE_CONFIRM, (msg, state) => {
    const isCorrect = msg.body.actions[0].value === 'create'

    if (!isCorrect) {
      msg.respond(msg.body.response_url, { text: 'Feature creation cancelled.' })
      return
    }

    msg.respond(msg.body.response_url, { text: 'Creating...' })
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
  jira
    .searchUsers({
      username: state.userProfile.email
    })
    .then((jiraUser) => {
      var fields = {
        project: { key: process.env.JIRA_FEATURE_PROJECT_PREFIX },
        issuetype: { name: 'Task' },
        summary: state.summary,
        description: `${state.description}\n\n----\n\n??(*g) Created by inMoBot on behalf of ${state.userProfile.real_name}??`,
        assignee: { name: components.getComponentOwnerJiraId(state.component) },
        priority: { name: state.priority },
        labels: getLabelArray(state)
      }
      if (jiraUser.length > 0) {
        state.jiraUserName = jiraUser[0].name
        fields.reporter = { name: state.jiraUserName }
      } else {
        // user had Slack access, but not JIRA access. don't set fields.reporter (inMoBot will just use the userid in the .env)
        console.log(`Warning: No JIRA user name found for ${state.userProfile.email}`)
      }

      jira
        .addNewIssue({
          fields: fields
        })
        .then((issue) => {
          msg.respond(msg.body.response_url, { text: 'Here is your JIRA feature:', delete_original: true }) // remove the "Creating" text
          // msg.say('Here is your JIRA feature:')
          fetchIssue.outputMessage(msg, issue.key, '', '')
        })
        .catch((error) => {
          console.log(error.message)
        })
    })
}

function isQuitter (msg, answer) {
  var quitter = false
  if (answer.toLowerCase() === 'quit') {
    quitter = true
    msg.say([ `Quitter! :stuck_out_tongue:`, `Fine, didn't want your Feature, anyway! :sob:`, `A day may come when we create a Feature, but *_It Is Not This Day!_* :crossed_swords:` ])
  }
  return quitter
}
