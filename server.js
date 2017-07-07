// Create a new feature in JIRA via a conversation with inMoBot
// Author: Darren Dunne

// TODO: deal value
// TODO: it's creating a Task in the DWD project - what about CLW?
// TODO: what's the correct issue type for CLW? "Improvement" ?
// TODO: throw early error if .env isn't setup correctly
// TODO: add it to the correct Account field in the created CLW (instead of the account- label)
// TODO: add Segment size
// TODO: better flag Churn risk? how to set a flag?
// TODO: allow user to quit midstream?
// TODO: change Account Y/N to "Current Account / Prospective Account / No"
// TODO: change the ownerJiraId in .env and beepboop to bkessman, et. al.

'use strict'

const express = require('express')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')
require('dotenv').config() // uid/pw go in .env file not checked in
const jiraUtils = require('./jiraUtils')

// use `PORT` env var on Beep Boop - default to 3000 locally
var port = process.env.PORT || 3000

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})

require('./flows')(slapp) // imports everything in the flows directory

// attach Slapp to express server
var server = slapp.attachToExpress(express())

// start http server
server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log(`Listening on port ${port}`)
  jiraUtils.refreshAccountsCache() // TODO: set this on a timer? or add a slash command to refresh it?
})
