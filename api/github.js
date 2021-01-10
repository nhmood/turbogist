const fetch = require('node-fetch')
const loadingTemplate = require('../views/auth.js');


const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_OAUTH_URL = `https://github.com//login/oauth/access_token?client_id=${GITHUB_CLIENT_ID}&client_secret=${GITHUB_CLIENT_SECRET}`;


// GET /api/github?code=[github_oauth2_authorization_code]
// Callback endpoint for GitHub OAuth2 authorization call
// Authorization code will be provided which we should be able to use to
// exchange for a (long lived) GitHub access token
//
// The response renders a HTML page that simply sets the response into
// localStorage and redirects back to the main page (JS app will handle state)
module.exports = (req, res) => {
  res.setHeader("Content-Type", "text/html");

  // If the request is missing the code parameter there is no authorization we can do
  // Return an error to the client
  if (req.query.code === undefined){
    console.log("GitHub authorization code (code parameter) missing in request, returning error");
    // TODO - add error code constant object + specific error code to response
    let payload = {
      state: "error",
      message: "Invalid GitHub authorization request"
    }

    // Format the response template with the error payload and return it to the client
    let tpl = loadingTemplate(payload);
    res.status(400).send(tpl);
    return;
  };


  // Pull the authorization code and format the HTTP authorization
  // request to GitHub
  let code        = req.query.code;
  let authorize   = `${GITHUB_OAUTH_URL}&code=${code}`;
  console.log(`Requesting GitHub User access ${authorize}`);


  // Perform the POST request to authorize the GitHub user
  fetch(authorize, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  })

    // Check to make sure the response status was OK
    .then(checkStatus)

    // Handle the response payload
    .then(resp => resp.text())
    .then(data => {
      let payload = handleJSON(data);
      // If we can't parse the JSON or the response isn't OK (from GitHub)
      // then throw an exception which will get handled in the catch below
      if (payload === undefined || payload.error != undefined){ throw data };

      // If we get a successful payload, format the template and respond to the client
      console.log(`GitHub authorization response: ${JSON.stringify(payload)}`);
      payload.state = "ok";
      let tpl = loadingTemplate(payload);
      res.status(200).send(tpl);
      return;
    })

    // If anything unexpected goes wrong, report the error and return
    // an error payload to the client
    .catch( err => {
      console.log(`Failed to authorize GitHub user: ${err}`)

      let payload = {
        state: "error",
        message: "GitHub authorization failed"
      }
      let tpl = loadingTemplate(payload);
      res.status(400).send(tpl);
      return;
    })

  return;
}


// Authorization error class
class AuthorizationError extends Error
{
  constructor(...params) {
    super(...params);
    this.message = `GitHub authorization failed`;
  }
}


// Helper to check the HTTP request status before passing it forward
function checkStatus(res) {
  if (res.ok) { // res.status >= 200 && res.status < 300
    return res;
  } else {
    res.text().then( data => { throw AuthorizationError(res.statusText, data) });
  }
}


// Helper to parse a JSON payload and return undefined if not able to
function handleJSON(data){
  try {
    payload = JSON.parse(data);
  } catch {
    console.warn(`Failed to parse JSON from: ${data}`)
    return undefined;
  }

  return payload;
}
