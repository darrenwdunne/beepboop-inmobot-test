'use strict'

module.exports = (slapp) => {
  const help = `inMoBot Commands:
\`help\` - to see this message
\`(clw-|cs-|jl-|mds-|px-|ra-|rel-|vm-|vnow-)1234\` - to fetch a JIRA issue (e.g. PX-1416 or VNOW-5081).
\`(bitbucket pull request url)\` - to fetch the related issue, and current status of approvers (e.g. https://bitbucket.org/inmotionnow/web-vnow/pull-requests/248/petr-vnow-3774-develop/diff)
\`request\` - open a new Request in the Client Wish List for Proximus, R+A, inMotion, or Mobile
\`rand\` - show me a random Low priority bug from the Spark Backlog
`

  slapp.command('/inmobot', /^\s*help\s*$/, (msg) => {
    msg.respond(help)
  })

  slapp.message('help', ['direct_mention', 'direct_message'], (msg, text) => {
    msg.say(help)
  })

  slapp.event('bb.team_added', function (msg) {
    slapp.client.im.open({ token: msg.meta.bot_token, user: msg.meta.user_id }, (err, data) => {
      if (err) {
        return console.error(err)
      }
      let channel = data.channel.id
      msg.say({ channel: channel, text: 'Thanks for adding me to your team!' })
      msg.say({ channel: channel, text: help })
    })
  })
}
