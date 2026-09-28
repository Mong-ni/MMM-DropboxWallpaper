require('dotenv').config()
const app = require('express')()
const fs = require('fs')
const { Dropbox } = require('dropbox')

const scheme = process.env.DROPBOX_AUTH_SCHEME
const hostname = process.env.DROPBOX_AUTH_HOSTNAME
const port = process.env.DROPBOX_AUTH_PORT
const key = process.env.DROPBOX_APP_KEY
//const secret = process.env.DROPBOX_APP_SECRET

const authUri = `${scheme}://${hostname}:${port}`
const redirectUri = `${scheme}://${hostname}:${port}/auth`

const [ major, , ] = process.versions.node.split('.').map(Number)
const config = {
  fetch : (major > 18) ? require('node-fetch') : fetch, // node 20 has fetch issue with Dropbox SDK
  clientId: key,
}

const dbx = new Dropbox(config)

app.get('/', (req, res) => {
  dbx.auth.getAuthenticationUrl(redirectUri, null, 'code', 'offline', null, 'none', true)
  .then((authUrl) => {
    res.writeHead(302, { Location: authUrl })
    res.end()
  })
})

app.get('/auth', (req, res) => {
  const { code } = req.query
  dbx.auth.getAccessTokenFromCode(redirectUri, code)
  .then((token) => {
    dbx.auth.setRefreshToken(token.result.refresh_token)
    dbx.usersGetCurrentAccount()
    .then((response) => {
      token.result.expires_at = Date.now() + token.result.expires_in * 1000 - 10000 // For the safe.  
      fs.writeFileSync('credentials.json', JSON.stringify(token.result, null, 2))
      const message = 'Successfully authenticated. You may now close the browser. Check credentials.json file.'
      console.log(message)
      app.close()
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
    })
  })
  .catch((error) => {
    console.error(error)
  })
  res.end()
})

app.listen(port)
console.log(`Server listening on ${authUri}, When the browser is not opened, open it manually`)
import('open').then(open => open.default(authUri))