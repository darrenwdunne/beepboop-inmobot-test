const JiraApi = require('jira-client')

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
const MSG_FEATURE_INTRO = ['You want to create a Feature? I can help with that!\n', "Create a Feature? Let's do it!"]
const MSG_QUIT_FEATURE_RESPONSES = ['A day may come when we create a Feature, but it is *_Not This Day!_* :crossed_swords:', "Fine! Didn't want your Feature anyway! :cry:", 'No Feature for You! :no_entry_sign:']

module.exports.config = function (slapp) {
  // "Conversation" flow that tracks state - kicks off when user says feature
  slapp.message('feature', ['direct_mention', 'direct_message'], (msg) => {
    var state = { requested: Date.now() }

    msg.say(MSG_FEATURE_INTRO)
      .say({
        text: '',
        attachments: [
          {
            text: 'Which component is this for? (if in doubt, just select inMotion)',
            fallback: 'Which component is this for?',
            callback_id: 'doit_confirm_callback', // unused?
            actions: [
              { name: 'answer', text: 'Proximus', type: 'button', value: 'Proximus' },
              { name: 'answer', text: 'R + A', type: 'button', value: 'R + A' },
              { name: 'answer', text: 'Mobile', type: 'button', value: 'Mobile' },
              { name: 'answer', text: 'inMotion', type: 'button', value: 'inMotion' },
              { name: 'answer', text: 'Cancel', type: 'button', value: 'cancel' }
            ]
          }]
      })
      .route('handleComponentSelection', state, 60)
  })

  slapp.route('handleComponentSelection', (msg, state) => {
    // if they respond with anything other than a button selection, get them back on track
    if (msg.type !== 'action') {
      msg
        .say('Please choose a Component button :wink:')
        // notice we have to declare the next route to handle the response every time. Pass along the state and expire the conversation 60 seconds from now.
        .route('handleComponentSelection', state, 60)
      return
    }
    msg.respond(msg.body.response_url, { delete_original: true })

    let answer = msg.body.actions[0].value

    switch (answer) {
      case 'cancel':
        msg.say(MSG_QUIT_FEATURE_RESPONSES)
        return
      default:
        state.component = answer
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

  slapp.route('handleCustomerConfirmation', (msg, state) => {
    // if they respond with anything other than a button selection, get them back on track
    if (msg.type !== 'action') {
      msg
        .say('Please choose a Yes, No, or Cancel button :wink:')
        // notice we have to declare the next route to handle the response every time. Pass along the state and expire the conversation 60 seconds from now.
        .route('handleCustomerConfirmation', state, 60)
      return
    }

    let answer = msg.body.actions[0].value

    switch (answer) {
      case 'cancel':
        msg.respond(msg.body.response_url, { delete_original: true })
          .say(MSG_QUIT_FEATURE_RESPONSES)
        return
      case 'yes':
        msg.respond(msg.body.response_url, { text: "Who's the customer?", delete_original: true })
          .route('handleCustomerName', state, 60)
        break
      case 'no':
        msg.respond(msg.body.response_url, { delete_original: true })
          .say('Give me a one-line Feature Summary' + MSG_QUIT_FEATURE_PROMPT)
          .route('handleSummary', state, 60)
        break
    }
  })

  slapp.route('handleCustomerName', (msg, state) => {
    var text = (msg.body.event && msg.body.event.text) || ''
    if (!text) {
      return msg.say("I'm eagerly awaiting to hear the customer name.").route('handleCustomerName', state)
    } else if (text === 'quit') {
      return msg.say(MSG_QUIT_FEATURE_RESPONSES)
    }

    state.customerName = text
    msg.say("Got it, we're creating a feature for " + text + '.\nPlease give me a one-line Feature Summary' + MSG_QUIT_FEATURE_PROMPT)
      .route('handleSummary', state, 60)
  })

  slapp.route('handleSummary', (msg, state) => {
    var text = (msg.body.event && msg.body.event.text) || ''
    if (!text) {
      return msg.say("I'm eagerly awaiting to hear the Summary").route('handleSummary', state)
    } else if (text === 'quit') {
      return msg.say(MSG_QUIT_FEATURE_RESPONSES)
    }

    state.summaryText = text
    msg.say('Now enter the Description text (hit Shift-Enter for multiple lines, Enter when done' + MSG_QUIT_FEATURE_PROMPT)
      .route('handleDescription', state, 60)
  })

  slapp.route('handleDescription', (msg, state) => {
    var text = (msg.body.event && msg.body.event.text) || ''
    if (text === 'quit') {
      msg.say(MSG_QUIT_FEATURE_RESPONSES)
      return
    }
    state.descriptionText = text
    // msg.say(`Here's what you've told me so far: \`\`\`${JSON.stringify(state)}\`\`\``)
    msg.say({
      text: "Here's the feature I'm going to create:\n\n*Summary:* " + state.summaryText + '\n*Customer:* ' + buildCustomerLabel(state.customerName) + '\n*Component:* ' + state.component + '\n*Description:*\n' + state.descriptionText,
      attachments: [
        {
          text: 'Looks Good? If so, hit `Create`',
          fallback: 'Looks Good? If so, hit `Create`',
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

  slapp.route('handleCreateConfirmation', (msg, state) => {
    // if they respond with anything other than a button selection, get them back on track
    if (msg.type !== 'action') {
      msg
        .say('Please choose a Create or Cancel button :wink:')
        // notice we have to declare the next route to handle the response every time. Pass along the state and expire the conversation 60 seconds from now.
        .route('handleCreateConfirmation', state, 60)
      return
    }

    let answer = msg.body.actions[0].value

    switch (answer) {
      case 'cancel':
        msg.respond(msg.body.response_url, { delete_original: true })
          .say(MSG_QUIT_FEATURE_RESPONSES)
        return
      case 'create':
        msg.respond(':zap:Creating:zap:', { delete_original: true })
        createIssueInJIRA(msg, state)
        break
    }
  })
}

function buildCustomerLabel (customer) {
  var newStr = 'account-' + customer.replace(' ', '').replace('-', '').toLowerCase()
  return newStr
}

function createIssueInJIRA (msg, state) {
  jira.addNewIssue({
    fields: {
      project: {key: 'DWD'}, // CLW
      issuetype: {name: 'Task'},
      summary: state.summaryText,
      description: state.descriptionText,
      assignee: {name: 'ddunne'},
      labels: ['inMoBot']
    }
  })
    .then(issue => {
      var issueKey = issue.key
      msg.say('Issue created: ' + issueKey)
    })
    .catch(error => {
      console.log(error.message)
    })
}

// jira.findIssue('REL-109')
//   .then(issue => {
//     msg.say(`JIRA Status of REL-109: ${issue.fields.status.name}`)
//   })
//   .catch(err => {
//     console.error(err)
//   })
