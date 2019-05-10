console.log("turbogist v1.0");
const GH_URL = "https://api.github.com";
const GH_AUTH_URL = GH_URL + "/authorizations";
const GH_USER_URL = GH_URL + "/user";
const GH_GIST_URL = GH_URL + "/gists";
const GH_PAGINATION = 10;


var loginMode = "credentials";
var isDemo = false;
var isLoggedIn = false;
var currentPage = 0;
var getGistInProgress = false;

const gistDataFormat = {
  "rawData": [],
  "pages": []
}
var gistData = Object.assign({}, gistDataFormat);



function setup(){
  isDemo      = localStorage.getItem("turbogist_auth") == "demo";
  isLoggedIn  = localStorage.getItem("turbogist_auth") != undefined;
  isLoggedIn  ? setupGist() : setupLogin();
}


function logout(){
  clearGists();
  localStorage.clear();
  setup();
}


function setupLogin(){
  setLoginUI();
}


function setupGist(){
  setGistBackend();
  setGistUI();
}


function toggleUI(state){
  states = ["login", "gists"];
  for (var i = 0; i < states.length; i++){
    var div = document.getElementById(states[i]);
    div.style.display = (states[i] == state) ? "block" : "none";
  }
}


function setLoginUI(){
  toggleUI("login");
}


function setGistBackend(){
  loadGistCache();
}


function setGistUI(){
  toggleUI("gists");

  // Set the GitHub User link
  var user = JSON.parse( localStorage.getItem("turbogist_user") );
  var gh_link = document.getElementById("gh_link");
  gh_link.href = "https://gist.github.com/" + user.login;
  gh_link.innerHTML = user.login;


  // Swap out the starting loading page
  var holding = document.getElementById("startup");
  holding.style.display = "none";
  var content = document.getElementById("loaded");
  content.style.display = "block";


  // Update the pagination and render the first page
  updatePagination();
  renderGists(0);
}


function setLoginMode(e){
  // Based on what element got selected, set the appropriate
  // div as visible and the corresponding loginMode
  var credentials = document.getElementById("credentials");
  var access_tokens = document.getElementById("access_token");
  if (e == "access_token"){
    credentials.style.display   = "none";
    access_tokens.style.display = "block";
    loginMode = "access_token";
  } else {
    credentials.style.display   = "block";
    access_tokens.style.display = "none";
    loginMode = "credentials";
  }
}


function checkInputs(){
  // Check the user inputs to make sure we have a valid login mode
  var login = document.getElementById( loginMode );
  inputs = login.querySelectorAll("input");
  for (var i = 0; i < inputs.length; i++){

    // If any of the values are set to "demo", update demo flag and skip this check
    // Sorry to whoever has demo@github
    if (inputs[i].value == "demo"){
      console.log("Demo account provided, skip input checks");
      isDemo = true;
      return true
    }

    // Make sure inputs are not blank
    var data = inputs[i].value.replace(/\s+/g,"");
    if (data.length == 0){
      return false;
    }
  }
  return true;
}


// UI handler for login state spinner
function setLoginStatus(state){
  var loginStatus = document.getElementById("login_status");
  switch(state){
    case "pending":
      loginStatus.className = "fas fa-spinner fa-spin";
      break;
    case "error":
      loginStatus.className = "fas fa-times-circle error";
      break;
    case "none":
      loginStatus.className = "";
      break;
  }
  return true;
}


// Top level login function that delegates based on the loginMode
function ghLogin(){
  // Check to make sure the user has provided us with useable inputs
  var validInputs = checkInputs();
  if (!validInputs) {
    setLoginStatus("error");
    return false;
  }


  // If we are in demo mode, set necessary local values, perform gist retrieval, and setup
  if (isDemo){
    localStorage.setItem("turbogist_auth", 'demo');
    localStorage.setItem("turbogist_user", JSON.stringify({"login": "demo", "html_url": "https://gist.github.com"}));
    getAllGists();
    setup();
    return true;
  }


  // Based on the login mode, call the corresponding login method
  // ghLoginCredentials - performs actual login to get token against /authorizations
  // ghLoginAccessToken - returns provided token in same format as above
  var access = (function(){
    switch(loginMode){
      case "credentials":
        return ghLoginCredentials();
      case "access_token":
        return ghLoginAccessToken();
    };
  })()
  // Handle an auth failure (bad auth will give !200)
  .then(  r => { if (!r.ok){ throw Error(r.statusText) }; return r.json() })

  // Store the auth data, attempt to use the token to get the user data
  .then(  d => { storeAuth( d ); return getUser(); })

  // getUser() will determine status of if auth was successful or not, handle accordingly
  .then(  d => { handleAuthSuccess(); })
  .catch( e => { handleAuthFailure( e ); });
}


function ghLoginAccessToken(){
  console.log("Logging in with token mode");
  setLoginStatus("pending");

  var token = document.getElementById("gh_access_token").value;
  console.debug("Using token" + token + " for token login");


  // Return a Promise with "ok" and "json()" fields so we can match
  // the same syntax as a fetch call to ghLogin()
  var p = new Promise(function(resolve, reject){
    var obj = {"ok": true, "json": function(e){ return {"token": token} }};
    resolve(obj);
  })

  return p;
}


function ghLoginCredentials(){
  console.log("Logging in with credential mode");
  setLoginStatus("pending");

  // Create the basic auth headers for retrieving access tokens from GH
  var headers = ghCreateBasicAuth();


  // Set the necessary parameters for retrieving a token from GH
  var data = {
    scopes: ["gist"],
    note: "turbogist",
    fingerprint: Math.random().toString(36).substring(7)
  }

	return fetch(GH_AUTH_URL, {
		method: "POST",
		headers: headers,
    body: JSON.stringify( data )
	})
}


function ghCreateBasicAuth(){
	console.log("Creating Basic Auth header for credential login");
	var username = document.getElementById("gh_username").value;
	var password = document.getElementById("gh_password").value;
	console.log("Username: " + username);
	console.log("Password: " + password);


  var ghBasicAuth = "Basic " + btoa(username + ":" + password);
	var headers = new Headers();
	headers.set('Authorization', ghBasicAuth);
  console.log("GitHub Authentication Header: " + ghBasicAuth);

  return headers;
}


function getUser(){
  console.log("Getting User information from " + GH_USER_URL);
  var headers = ghSetTokenHdr();

  return fetch(GH_USER_URL, {
    method: "GET",
    headers: headers,
    cache: "no-cache"
  })
  .then(  r => { if (!r.ok){ throw Error(r.statusText) }; return r.json() })
  .then(  d => { console.log(d); localStorage.setItem("turbogist_user", JSON.stringify(d)) })
  .catch( e => { throw Error("getUser failed"); })
}


function handleAuthFailure( d ){
  console.log("Handling failed auth event");
  localStorage.removeItem("turbogist_auth");
  setLoginStatus("error");
}


function handleAuthSuccess( d ) {
  console.log("Handling successful auth event");
  setLoginStatus("none");

  var login = document.getElementById( loginMode );
  inputs = login.querySelectorAll("input");
  for (var i = 0; i < inputs.length; i++){
    var data = inputs[i].value = "";
  }
  setup();
  getAllGists();
}


function storeAuth(data){
  console.log("Storing GH Auth to localStorage");
  localStorage.setItem("turbogist_auth", JSON.stringify(data)) ;
  localStorage.setItem("turbogist_since", 0);
  return true;
}


function ghSetTokenHdr(){
  // If demo, skip the headers
  if (isDemo){ console.log(isDemo); return new Headers() };

  var token_data = localStorage.getItem("turbogist_auth");
  if (token_data === null){
    console.log("GitHub tokens are broken");
    return false;
  }

  var token = JSON.parse(token_data);
	var headers = new Headers();
	headers.set('Authorization', "token " + token.token);
  console.log(headers);

  return headers;
}


function resetSince(){
  localStorage.setItem("turbogist_since", 0);
}


function clearGists(){
  localStorage.removeItem("turbogist_gistdata");
  gistData = Object.assign({}, gistDataFormat);
}


function getAllGists(){
  resetSince();
  clearGists();
  updateGists();
}


function refreshState(state){
  var refresh = document.getElementById("refresh_loading");
  switch(state) {
    case "pending":
      refresh.className = "fas fa-sync-alt fa-spin";
      break;
    case "none":
      refresh.className = "fas fa-sync-alt";
      break;
    case "error":
      refresh.className = "fas fa-sync-alt error";
      break;
  }

  getGistInProgress = false;
  return true;
}


function updateGists(){
  if (getGistInProgress){ console.log("getAllGist already in progress"); return false };
  getGistInProgress = true;

  refreshState("pending");

  var since = new Date(localStorage.getItem("turbogist_since"));
  var url = GH_GIST_URL + "?since=" + since.toISOString();

  getGists(url, 1).then( e => {
    console.log("All pages parsed for getAllGists(), updating getGistInProgress and turbogist_since");
    var currentTime = new Date();
    localStorage.setItem("turbogist_since", currentTime);
    cacheGists();
    refreshState("none");
  })
  .catch( e => { refreshState("error"); })
}


function getGists(url, page){
  var headers = ghSetTokenHdr();
  var pageURL = url + "&page=" + page;
  console.log("getGists->" + pageURL);


  return fetch(pageURL, {
    method: "GET",
    headers: headers,
    cache: "no-cache"
  })
  .then(  r => { if (!r.ok){ throw Error(r.statusText) }; return r.json(); })
  .then(  d => { storeGists( d ); page == 1 ? renderGists(0) : false; if (isDemo && (page > 4)){ return true }; return (d.length != 0) ? getGists(url, page + 1) : true; })
  .catch( e => { console.log(e); throw Error("getGist failed - " + e); })
}


function sortGistData(data){
  data.sort(function(a, b){ return new Date(b.updated_at) - new Date(a.updated_at)})
};


function storeGists(data){
  console.log("Storing Gist data locally");

  // Concatenate the newly loaded data to the existing local container,
  // sort it, and finally store it back locally
  var rawData = data.concat(gistData.rawData);
  sortGistData(gistData.rawData);
  gistData.rawData = rawData;

  updatePagination();
}


function createPaginationLink(page) {
  return function() { renderGists(page); };
}


function updatePagination(){
  // Grab and clear the current pagination
  var pagination = document.getElementById("gist_pagination");
  pagination.innerHTML = "";

  for (var i = 0; i < gistData.rawData.length / GH_PAGINATION; i++){
    var link = document.createElement("a");
    link.href = "#/page/" + (i + 1);
    link.onclick = createPaginationLink(i);
    link.innerHTML = i + 1;
    pagination.appendChild(link);
  }
}


function renderGists(page){
  console.log("Rendering page: " + page);
  var table = document.getElementById("gist_list");
  // Should I use ChildNode.replaceWith()?
  table.innerHTML = "";

  // Determine the start and end range and slice out of gistData.rawData
  var start = page * GH_PAGINATION;
  var end   = start + GH_PAGINATION;
  var gists = gistData.rawData.slice(start, end);


  // Go through all the gists and render a row
  for (var i = 0; i < gists.length; i++){
    var gist = gists[i];
    var el = document.createElement("tr");

    // Main link (lock, name + link, updated, created)
    var main = document.createElement("td");
    var public = gist.public ? '<i class="fas fa-lock-open green public"></i>' : '<i class="fas fa-lock public"></i>' ;
    main.innerHTML = public + " <a href='" + gist.html_url + "' target='_blank'>" + Object.keys(gist.files)[0] + "</a>";

    // Updated datetime using fuzzy string
    var updated = fuzzyTime(gist.updated_at);
    var updated_text = ' <div class="row updated" title="' + (new Date(gist.updated_at)) + '">updated: ' + updated + '</div>';
    main.innerHTML += updated_text;

    // Updated datetime using fuzzy string
    var created = fuzzyTime(gist.created_at);
    var created_text = '<div class="row created" title="' + (new Date(gist.created_at)) + '">created: ' + created + '</div>';
    main.innerHTML += created_text;
    el.appendChild(main);

    // Gist Actions
    var actions = document.createElement("td");
    var gistEdit = '<a href="' + getGistEditLink(gist) + '" target="_blank" title="Edit Gist"><i class="fas fa-edit"></i></a> ';
    var gistDelete = '<a href="#/gists/' + gist.id + '/delete" onclick="deleteGist(\'' + gist.id + '\');"><i class="far fa-trash-alt"></i></a>';

    actions.innerHTML = gistEdit + gistDelete;
    el.appendChild(actions);


    // Append the row to the table
    table.appendChild(el);
  }
}


// Get individual Gist
function getGist(gist){
  var headers = ghSetTokenHdr();
  var pageURL = gist.url;
  console.log("getGist->" + pageURL);


  return fetch(pageURL, {
    method: "GET",
    headers: headers,
    cache: "no-cache"
  })
  .then(  r => { if (!r.ok){ throw Error(r.statusText) }; return r.json(); })
  .then(  d => { storeGist( d ); return true; })
  .catch( e => { console.log(e); throw Error("getGist failed - " + e); })
}

// Delete individual Gist by id
function deleteGist(id){
  var headers = ghSetTokenHdr();
  var pageURL = GH_URL + '/gists/' + id;

  return fetch(pageURL, {
    method: "DELETE",
    headers: headers
  })
  .then(  r => { if (!r.ok){ throw Error(r.statusText) }; return id; })
  .then(  d => { removeGist( d ); })
  .catch( e => { console.log(e); throw Error("deleteGist failed - " + e); })
}


function removeGist(id){
  console.log("removeGist(id) - NOT IMPLEMENTED");
}


function storeGist(data){
  console.log("storeGist(data) - NOT IMPLEMENTED");
}


function getGistEditLink(gist){
  return "https://gist.github.com/" + gist.owner.login + '/' + gist.id + '/edit';
}


function cacheGists(){
  // Sort gist data then store into localStorage
  sortGistData(gistData.rawData);
  localStorage.setItem("turbogist_gistdata", JSON.stringify(gistData));
}


// Load gist data from localStorage
function loadGistCache(){
  console.log("Attempting to load gistData from localStorage cache");
  var cacheData = localStorage.getItem("turbogist_gistdata");
  if (cacheData == undefined){
    console.log("gistData was not stored in localStorage!");
    return false
  }
  gistData = JSON.parse(cacheData);
}


// Friendly time
function fuzzyTime(time){
  var delta = (new Date() - (new Date(time))) / 1000;
  delta = Math.round(delta)
  var minute  = 60,
      hour    = minute * 60,
      day     = hour * 24,
      week    = day * 7,
      month   = week * 4,
      year    = month * 12;

  var fuzzy;

  if (delta < 30) {
        fuzzy = 'just now.';
  } else if (delta < minute) {
        fuzzy = delta + ' seconds ago.';
  } else if (delta < 2 * minute) {
        fuzzy = 'a minute ago.'
  } else if (delta < hour) {
        fuzzy = Math.floor(delta / minute) + ' minutes ago.';
  } else if (Math.floor(delta / hour) == 1) {
        fuzzy = '1 hour ago.'
  } else if (delta < day) {
        fuzzy = Math.floor(delta / hour) + ' hours ago.';
  } else if (delta < day * 2) {
        fuzzy = 'yesterday';
  } else if (delta < week) {
      fuzzy = Math.floor(delta / day) + ' days ago.';
  } else if (Math.floor(delta / week) == 1){
    fuzzy = '1 week ago.';
  } else if (delta < month) {
    fuzzy = Math.floor(delta / week) + ' weeks ago.';
  } else if (delta < year) {
    fuzzy = Math.floor(delta / month) + ' months ago.';
  } else {
    fuzzy = Math.floor(delta / year) + ' years ago.';
  }

  return fuzzy;
}


document.addEventListener("DOMContentLoaded", function() { setup() });
