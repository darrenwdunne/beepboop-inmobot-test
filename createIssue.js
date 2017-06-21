const JiraApi = require('jira-client')
const fetchIssue = require('./fetchIssue')
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

const MSG_QUIT_FEATURE_PROMPT = ', or type `quit` to stop creating the feature request'
const MSG_FEATURE_INTRO = ['You want to create a Feature? I can help with that!\n', "Create a Feature? Let's do it!", "Let's create a Feature!"]
const MSG_QUIT_FEATURE_RESPONSES = ['A day may come when we create a Feature, but *_It Is Not This Day!_* :crossed_swords:', "Fine! Didn't want your Feature anyway! :cry:", 'No Feature for You! :no_entry_sign:']

var config = function (slapp) {
  // "Conversation" flow that tracks state - kicks off when user says feature
  slapp.command('/feature', (msg) => {
    var state = { requested: Date.now() }
    slapp.client.users.info({token: msg.meta.bot_token, user: msg.meta.user_id}, (err, result) => {
      if (err) {
        console.log(err)
      }
      state.userProfile = result.user.profile // incl. first_name real_name real_name_normalized email

      msg.say('Hi ' + state.userProfile.first_name + '!\n')
        .say(MSG_FEATURE_INTRO)
        .say({
          text: '',
          attachments: [
            {
              text: 'Which component is this for? (if in doubt, just select inMotion)',
              fallback: 'Which component is this for?',
              callback_id: 'doit_confirm_callback', // unused?
              actions: components.getComponentButtons()
            }]
        })
        .route('handleComponentSelection', state, 60)
    })
  })
    .route('handleComponentSelection', (msg, state) => {
      // if they respond with anything other than a button selection, get them back on track
      if (msg.type !== 'action') {
        msg
          .say('Please choose a Component button :wink:')
          // notice we have to declare the next route to handle the response every time. Pass along the state and expire the conversation 60 seconds from now.
          .route('handleComponentSelection', state, 60)
        return
      }
      msg.respond(msg.body.response_url, { delete_original: true }) // remove the buttons

      let answer = msg.body.actions[0].value

      switch (answer) {
        case 'cancel':
          msg.say(MSG_QUIT_FEATURE_RESPONSES)
          return
        default:
          const owner = components.getComponentOwner(answer)
          msg.say(owner + ' is going to be excited to hear about your new ' + answer + ' feature!')
          state.component = answer
          break
      }

      msg.say({
        text: '',
        attachments: [
          {
            text: 'What is the Priority of this Feature?',
            fallback: 'What is the Priority of this Feature?',
            callback_id: 'doit_confirm_callback', // unused?
            actions: [
              { name: 'answer', text: 'Customer may churn!', type: 'button', value: 'Critical' },
              { name: 'answer', text: 'High', type: 'button', value: 'High' },
              { name: 'answer', text: 'Medium', type: 'button', value: 'Medium' },
              { name: 'answer', text: 'Low', type: 'button', value: 'Low' },
              { name: 'answer', text: 'Cancel', type: 'button', value: 'cancel' }
            ]
          }]
      })
        // handle the response with this route passing state and expiring the conversation after 60 seconds
        .route('handlePriorityConfirmation', state, 60)
    })
    .route('handlePriorityConfirmation', (msg, state) => {
      // if they respond with anything other than a button selection, get them back on track
      if (msg.type !== 'action') {
        msg
          .say('Please choose a Priority button :wink:')
          // notice we have to declare the next route to handle the response every time. Pass along the state and expire the conversation 60 seconds from now.
          .route('handlePriorityConfirmation', state, 60)
        return
      }
      msg.respond(msg.body.response_url, { delete_original: true }) // remove the buttons

      let answer = msg.body.actions[0].value

      switch (answer) {
        case 'cancel':
          msg.say(MSG_QUIT_FEATURE_RESPONSES)
          return
        default:
          state.priority = answer
          break
      }

      msg.say({
        text: '',
        attachments: [
          {
            text: 'Is this for a customer?',
            fallback: 'Is this for a customer?',
            callback_id: 'doit_confirm_callback', // unused?
            actions: [
              { name: 'answer', text: 'Yes', type: 'button', value: 'yes' },
              { name: 'answer', text: 'No', type: 'button', value: 'no' },
              { name: 'answer', text: 'Cancel', type: 'button', value: 'cancel' }
            ]
          }]
      })
        // handle the response with this route passing state and expiring the conversation after 60 seconds
        .route('handleCustomerConfirmation', state, 60)
    })
    .route('handleCustomerConfirmation', (msg, state) => {
      // if they respond with anything other than a button selection, get them back on track
      if (msg.type !== 'action') {
        msg
          .say('Please choose a Yes, No, or Cancel button :wink:')
          // notice we have to declare the next route to handle the response every time. Pass along the state and expire the conversation 60 seconds from now.
          .route('handleCustomerConfirmation', state, 60)
        return
      }
      msg.respond(msg.body.response_url, { delete_original: true }) // remove the buttons

      let answer = msg.body.actions[0].value

      switch (answer) {
        case 'cancel':
          msg.say(MSG_QUIT_FEATURE_RESPONSES)
          return
        case 'yes':
          msg.say("Who's the customer?")
            .route('handleCustomerName', state)
          break
        case 'no':
          msg.say('Give me a one-line Feature Summary' + MSG_QUIT_FEATURE_PROMPT)
            .route('handleSummary', state)
          break
      }
    })
    .route('handleCustomerName', (msg, state) => {
      var text = (msg.body.event && msg.body.event.text) || ''
      if (!text) {
        return msg.say("I'm eagerly awaiting to hear the customer name.").route('handleCustomerName', state)
      } else if (text === 'quit') {
        return msg.say(MSG_QUIT_FEATURE_RESPONSES)
      }
      state.customerName = text
      msg.say("Got it, we're creating a feature for " + text + '.\nPlease give me a one-line Feature Summary' + MSG_QUIT_FEATURE_PROMPT)
        .route('handleSummary', state)
    })
    .route('handleSummary', (msg, state) => {
      var text = (msg.body.event && msg.body.event.text) || ''
      if (!text) {
        return msg.say("I'm eagerly awaiting to hear the Summary").route('handleSummary', state)
      } else if (text === 'quit') {
        return msg.say(MSG_QUIT_FEATURE_RESPONSES)
      }

      state.summaryText = text
      // msg.say(msg.body.response_url, { delete_original: true })
      msg.say('Now enter the Description text (hit Shift-Enter for multiple lines, Enter when done' + MSG_QUIT_FEATURE_PROMPT)
        .route('handleDescription', state)
    })
    .route('handleDescription', (msg, state) => {
      var text = (msg.body.event && msg.body.event.text) || ''
      if (text === 'quit') {
        msg.say(MSG_QUIT_FEATURE_RESPONSES)
        return
      }
      state.descriptionText = text
      // msg.say(`Here's what you've told me so far: \`\`\`${JSON.stringify(state)}\`\`\``)
      msg.say({
        text: getFeatureCreationSummaryText(state),
        attachments: [
          {
            text: 'Looks Good? If so, click Create',
            fallback: 'Looks Good? If so, click Create',
            callback_id: 'doit_confirm_callback', // unused?
            actions: [
              { name: 'answer', text: 'Create', type: 'button', value: 'create' },
              { name: 'answer', text: 'Cancel', type: 'button', value: 'cancel' }
            ]
          }]
      })
        // handle the response with this route passing state and expiring the conversation after 60 seconds
        .route('handleCreateConfirmation', state, 60)
    })
    .route('handleCreateConfirmation', (msg, state) => {
      // if they respond with anything other than a button selection, get them back on track
      if (msg.type !== 'action') {
        msg
          .say('Please choose a Create or Cancel button :wink:')
          // notice we have to declare the next route to handle the response every time. Pass along the state and expire the conversation 60 seconds from now.
          .route('handleCreateConfirmation', state, 60)
        return
      }
      msg.respond(msg.body.response_url, { delete_original: true }) // remove the buttons

      let answer = msg.body.actions[0].value

      switch (answer) {
        case 'cancel':
          msg.say(MSG_QUIT_FEATURE_RESPONSES)
          return
        case 'create':
          // msg.say(msg.body.response_url, { text: ':zap:Creating:zap:', delete_original: true }) // remove the buttons, so user cannot click again
          msg.say(':zap:Creating:zap:') // remove the buttons, so user cannot click again
          createIssueInJIRA(msg, state)
          break
      }
    })
}

function getFeatureCreationSummaryText (state) {
  var text = "Here's the feature I'm going to create:\n\n*Summary:* " + state.summaryText
  if (state.customerName !== undefined && state.customerName !== '') {
    text += '\n*Customer:* ' + state.customerName
  }
  text += '\n*Component:* ' + state.component + '\n*Priority:* ' + state.priority + '\n*Description:*\n' + state.descriptionText
  return text
}

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
  jira.addNewIssue({
    fields: {
      project: {key: 'DWD'}, // TODO: change to CLW
      issuetype: {name: 'Task'},
      summary: state.summaryText,
      description: state.descriptionText + '\n\n----\n\n??(*g) Created by inMoBot on behalf of ' + state.userProfile.real_name + '??',
      assignee: {name: 'ddunne'}, // TODO: dynamic
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
}

exports.config = config

// jira.findIssue('REL-109')
//   .then(issue => {
//     msg.say(`JIRA Status of REL-109: ${issue.fields.status.name}`)
//   })
//   .catch(err => {
//     console.error(err)
//   })
