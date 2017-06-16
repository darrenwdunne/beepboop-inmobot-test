'use strict'

const express = require('express')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')
require('dotenv').config() // uid/pw go in .env file not checked in
const createIssue = require('./createIssue')
const fetchIssue = require('./fetchIssue')

// use `PORT` env var on Beep Boop - default to 3000 locally
var port = process.env.PORT || 3000

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})

// response to the user typing "help"
slapp.message('help', ['mention', 'direct_message'], (msg) => {
  msg.say(`
Howdy! I will respond to the following messages:
\`help\` - to see this message
\`(cs-|ra16-|mds-|px-|vm-|vnow-)1234\` - to fetch a JIRA issue (e.g. PX-1416 or VNOW-5081).
\`(bitbucket pull request url)\` - to fetch the related issue, and current status of approvers (e.g. https://bitbucket.org/inmotionnow/web-vnow/pull-requests/248/petr-vnow-3774-develop/diff)
\`feature\` - open a feature against inMotion
\`rand\` - show me a random Low priority bug from the Spark Backlog
`)
})

fetchIssue.config(slapp)
createIssue.config(slapp)

// attach Slapp to express server
var server = slapp.attachToExpress(express())

// start http server
server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log(`Listening on port ${port}`)
})
