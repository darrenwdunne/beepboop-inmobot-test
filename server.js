'use strict'

const express = require('express')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')
require('dotenv').config() // uid/pw go in .env file not checked in

const jira = require('./jira')

// use `PORT` env var on Beep Boop - default to 3000 locally
var port = process.env.PORT || 3000

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})

var HELP_TEXT = `
I will respond to the following messages:
\`help\` - to see this message
\`(ra16-|mds-|px-|vm-|vnow-)1234\` - to fetch a JIRA issue (e.g. PX-1416 or VNOW-5081).
\`rand\` - show me a random Low priority bug from the Spark Backlog
`

// *********************************************
// Setup different handlers for messages
// *********************************************

// response to the user typing "help"
slapp.message('help', ['mention', 'direct_message'], (msg) => {
  msg.say(HELP_TEXT)
})

// return a random Spark low priority bug from the backlog
slapp.message('rand', ['mention', 'direct_message'], (msg) => {
  const bugs = ['VNOW-6343','VNOW-6340','VNOW-6338','VNOW-6334','VNOW-6330','VNOW-6329','VNOW-6328','VNOW-6327','VNOW-6317','VNOW-6215','VNOW-6188','VNOW-6185','VNOW-6184','VNOW-6176','VNOW-6175','VNOW-6172','VNOW-6151','VNOW-6150','VNOW-6146','VNOW-6144','VNOW-6137','VNOW-6133','VNOW-6128','VNOW-6124','VNOW-6122','VNOW-6115','VNOW-6113','VNOW-6107','VNOW-6096','VNOW-6094','VNOW-6093','VNOW-6092','VNOW-6087','VNOW-6082','VNOW-6081','VNOW-6078','VNOW-6076','VNOW-6074','VNOW-6072','VNOW-6042','VNOW-6024','VNOW-6020','VNOW-5992','VNOW-5974','VNOW-5971','VNOW-5961','VNOW-5932','VNOW-5928','VNOW-5914','VNOW-5900','VNOW-5891','VNOW-5890','VNOW-5879','VNOW-5868','VNOW-5867','VNOW-5843','VNOW-5825','VNOW-5804','VNOW-5756','VNOW-5739','VNOW-5733','VNOW-5696','VNOW-5691','VNOW-5643','VNOW-5561','VNOW-5527','VNOW-5492','VNOW-5483','VNOW-5476','VNOW-5452','VNOW-5423','VNOW-5422','VNOW-5399','VNOW-5366','VNOW-5365','VNOW-5340','VNOW-5319','VNOW-5303','VNOW-5293','VNOW-5290','VNOW-5239','VNOW-5224','VNOW-5200','VNOW-5184','VNOW-5160','VNOW-5108','VNOW-5104','VNOW-5072','VNOW-5016','VNOW-4993','VNOW-4989','VNOW-4976','VNOW-4905','VNOW-4903','VNOW-4901','VNOW-4900','VNOW-4874','VNOW-4873','VNOW-4870','VNOW-4864','VNOW-4840','VNOW-4835','VNOW-4834','VNOW-4830','VNOW-4817','VNOW-4809','VNOW-4808','VNOW-4807','VNOW-4806','VNOW-4758','VNOW-4742','VNOW-4725','VNOW-4707','VNOW-4577','VNOW-4547','VNOW-4250','VNOW-3870','VNOW-3759','VNOW-3523','VNOW-2903']
  const issueKey = Math.floor(Math.random() * bugs.length)
  outputMessage(msg, bugs[issueKey], 'Here\'s a random Low priority bug from the Spark backlog')
})

// Respond to a JIRA issue (e.g. PX-1234)
slapp.message(/(ra16-|mds-|px-|vm-|vnow-)(\d+)/i, ['mention', 'direct_message', 'ambient'], (msg) => {
  var text = (msg.body.event && msg.body.event.text) || ''
  var pattern = /(ra16-|mds-|px-|vm-|vnow-)(\d+)/ig
  var match = text.match(pattern)

  // there may be multiple issues in the text
  for (var i = 0; i < match.length; i++) {
    const issueKey = match[i].toUpperCase()
    outputMessage(msg, issueKey, '')
  }
})

function outputMessage (msg, issueKey, introText) {
  // these env vars are configured during bot installation and passed in during initialization
  jira.getIssue(process.env.JIRA_URL, process.env.JIRA_U, process.env.JIRA_P, issueKey).then(jiraIssue => {
    var avatarUrl = null
    if (jiraIssue.fields.assignee != null) {
      avatarUrl = jiraIssue.fields.assignee.avatarUrls['48x48']
    }
    var color = 'good'
    switch (jiraIssue.fields.issuetype.name) {
      case 'Bug':
      case 'Bug-task':
        switch (jiraIssue.fields.priority.name) {
          case 'Open':
            color = 'good'
            break
          case 'High':
            color = 'danger'
            break
          case 'Medium':
            color = 'warning'
            break
        }
        break
      case 'Story':
        color = '#63BA3C'
        break
      case 'Task':
      case 'Sub-task':
        color = '#4BADE8'
        break
      case 'Epic':
        color = '#904EE2'
        break
    }
    msg.say({
      text: introText,
      attachments: [{
        text: '',
        title: issueKey + ': ' + jiraIssue.fields.summary,
        thumb_url: avatarUrl,
        title_link: 'https://inmotionnow.atlassian.net/browse/' + issueKey,
        mrkdwn_in: ['fields'],
        'fields': [
          {
            'title': 'Status',
            'value': '`' + jiraIssue.fields.status.name + '`',
            'short': true
          },
          {
            'title': 'Assignee',
            'value': jiraIssue.fields.assignee === null ? 'Unassigned' : jiraIssue.fields.assignee.displayName,
            'short': true
          },
          {
            'title': 'Priority',
            'value': '`' + jiraIssue.fields.priority.name + '`',
            'short': true
          },
          {
            'title': 'Type',
            'value': jiraIssue.fields.issuetype.name,
            'short': true
          }
        ],
        color: color
      }]
    })
  }).catch((err) => {
    console.log(err)
    msg.say({
      text: "Sorry, couldn't find " + issueKey + ' :cry:'
    })
  })
}

// // "Conversation" flow that tracks state - kicks off when user says hi, hello or hey
// slapp
//   .message('^(hi|hello|hey)$', ['direct_mention', 'direct_message'], (msg, text) => {
//     msg
//       .say(`${text}, how are you?`)
//       // sends next event from user to this route, passing along state
//       .route('how-are-you', { greeting: text })
//   })
//   .route('how-are-you', (msg, state) => {
//     var text = (msg.body.event && msg.body.event.text) || ''

//     // user may not have typed text as their next action, ask again and re-route
//     if (!text) {
//       return msg
//         .say("Whoops, I'm still waiting to hear how you're doing.")
//         .say('How are you?')
//         .route('how-are-you', state)
//     }

//     // add their response to state
//     state.status = text

//     msg
//       .say(`Ok then. What's your favorite color?`)
//       .route('color', state)
//   })
//   .route('color', (msg, state) => {
//     var text = (msg.body.event && msg.body.event.text) || ''

//     // user may not have typed text as their next action, ask again and re-route
//     if (!text) {
//       return msg
//         .say("I'm eagerly awaiting to hear your favorite color.")
//         .route('color', state)
//     }

//     // add their response to state
//     state.color = text

//     msg
//       .say('Thanks for sharing.')
//       .say(`Here's what you've told me so far: \`\`\`${JSON.stringify(state)}\`\`\``)
//   // At this point, since we don't route anywhere, the "conversation" is over
//   })

// // Can use a regex as well
// slapp.message(/^(thanks|thank you)/i, ['mention', 'direct_message'], (msg) => {
//   // You can provide a list of responses, and a random one will be chosen
//   // You can also include slack emoji in your responses
//   msg.say([
//     "You're welcome :smile:",
//     'You bet',
//     ':+1: Of course',
//     'Anytime :sun_with_face: :full_moon_with_face:'
//   ])
// })

// // demonstrate returning an attachment...
// slapp.message('attachment', ['mention', 'direct_message'], (msg) => {
//   msg.say({
//     text: 'Check out this amazing attachment! :confetti_ball: ',
//     attachments: [{
//       text: 'Slapp is a robust open source library that sits on top of the Slack APIs',
//       title: 'Slapp Library - Open Source',
//       image_url: 'https://storage.googleapis.com/beepboophq/_assets/bot-1.22f6fb.png',
//       title_link: 'https://beepboophq.com/',
//       color: '#7CD197'
//     }]
//   })
// })

// // Catch-all for any other responses not handled above
// slapp.message('.*', ['direct_mention', 'direct_message'], (msg) => {
//   // respond only 40% of the time
//   if (Math.random() < 0.4) {
//     msg.say([':wave:', ':pray:', ':raised_hands:'])
//   }
// })

// attach Slapp to express server
var server = slapp.attachToExpress(express())

// start http server
server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log(`Listening on port ${port}`)
})
