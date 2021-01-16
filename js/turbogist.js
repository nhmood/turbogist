console.log("turbogist v1.0");
const GITHUB_BASE_URL = "https://api.github.com";
const GH_USER_URL = GITHUB_BASE_URL + "/user";
const GH_GIST_URL = GITHUB_BASE_URL + "/gists";
const GH_PAGINATION = 10;



const TG = {
  'getGistInProgress': false
};
var isDemo = false;

const gistDataFormat = {
  "rawData": [],
  "pages": []
}


async function setup(){
  await handleAuthInit();

  setNav("");

  // Check whether we are in demo mode or not
  let isDemoMode = checkDemoMode();
  if (isDemoMode){
    return demoMode();
  }

  isLoggedIn  = localStorage.getItem("tgAccessToken") != undefined;
  isLoggedIn  ? setupGist() : setupLogin();
}

async function handleAuthInit(){
  // Check for existence of the tgAuthInit localStorage entry
  // If this isn't set, then we don't need to initialize turbogist
  // Make sure to remove the tgAuthInit so we don't rerun through
  // the auth again
  let authData = localStorage.getItem("tgAuthInit");
  localStorage.removeItem("tgAuthInit");

  if (authData == undefined){ return false; }

  // Parse the authData and depending on the state handle success/failure
  let auth = JSON.parse(authData);
  if (auth.state != "ok"){
    console.error(`GitHub User Authorization failed -> ${auth}`);
    show("login_error");
  }

  // If the auth was successful, store the access token then initialize turbogist
  localStorage.setItem("tgAccessToken", auth.access_token);
  TG.access_token = auth.access_token;

  clearGists();
  // TODO - add initial loading spinner div
}

function checkDemoMode(){
  return document.location.hash.match(/#demo/) != undefined;
}

function demoMode(){
  console.log("DEMO MODE");
}


function resetGists(){
  clearGists();
  setup();
}

function resetDB(){
  clearGists();
  localStorage.clear();
  Object.keys(TG).forEach(f => { TG[f] = undefined })
  setup();
}


function logout(){
  resetDB();
  setup();
}


function setupLogin(){
  enableLoginUI();
}


async function setupGist(){
  await getUser();
  initFromCache();
  enableGistUI();
  await updateGists();
}


function toggleUI(state){
  states = ["login", "gists"];
  for (var i = 0; i < states.length; i++){
    var div = document.getElementById(states[i]);
    div.style.display = (states[i] == state) ? "block" : "none";
  }
}


function enableLoginUI(){
  toggleUI("login");
}


function enableGistUI(){
  toggleUI("gists");

  // Update the pagination and render the first page
  updatePagination();
  renderGists(0);
}


function setDB(key, value){
  TG[key] = value;

  let lsKey = getLSKey(key);
  localStorage.setItem(lsKey, JSON.stringify(value));
}

function getLSKey(key){
  return `tg${capitalize(key)}`;
}

async function getUser(force = false){
  console.log("Getting User information from " + GH_USER_URL);
  if (!force && TG.user){ console.log("User Data already set"); return; }
  var headers = ghSetTokenHdr();

  let data = await request(GH_USER_URL, {
    method: "GET",
    headers: headers,
    cache: "no-cache"
  })
  .catch(e => { throw Error(`getUser Failed ${e}`) });
  console.log(data);

  setDB("user", data);
  setUserUI();
}


function setUserUI(){
  // Set the GitHub User link
  var gh_link = document.getElementById("gh_link");
  gh_link.href = "https://gist.github.com/" + TG.user.login;
  gh_link.innerHTML = TG.user.login;


  // Swap out the starting loading page
  var holding = document.getElementById("startup");
  holding.style.display = "none";
  var content = document.getElementById("loaded");
  content.style.display = "block";
}


async function request(path, opts){
  let response = await fetch(path, opts);
  if (!response.ok){ throw Error(response.statusText) };
  let payload = await response.json();

  return payload;
}


function ghSetTokenHdr(){
  // If demo, skip the headers
  if (isDemo){ console.log(isDemo); return new Headers() };

  var token = localStorage.getItem("tgAccessToken");
  if (token === null){
    console.log("GitHub tokens are broken");
    return false;
  }

  var headers = new Headers();
  headers.set('Authorization', "token " + token);

  return headers;
}


function clearGists(){
  setDB("since", 0);
  setDB("gists", Object.assign({}, gistDataFormat));
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

  TG.getGistInProgress = false;
  return true;
}


function updateGists(){
  if (TG.getGistInProgress){ console.log("getAllGist already in progress"); return false };
  TG.getGistInProgress = true;

  refreshState("pending");

  var since = new Date(TG.since);
  var url = GH_GIST_URL + "?since=" + since.toISOString();

  return getGists(url, 1).then( e => {
    console.log("All pages parsed for getAllGists(), updating getGistInProgress and tgSince");
    var currentTime = new Date();
    setDB("since", currentTime);
    cacheGists();
    refreshState("none");
  })
  .catch( e => { console.log(e); refreshState("error"); })
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
  return data.sort(function(a, b){ return new Date(b.updated_at) - new Date(a.updated_at)})
};


function storeGists(data){
  console.log("Storing Gist data locally");

  // Concatenate the newly loaded data to the existing local container,
  // sort it, and finally store it back locally
  var rawData = data.concat(TG.gists.rawData);
  sortedData = sortGistData(rawData);
  TG.gists.rawData = sortedData;

  updatePagination();
}


function createPaginationLink(page) {
  return function() { renderGists(page); };
}


function updatePagination(){
  // Grab and clear the current pagination
  var pagination = document.getElementById("gist_pagination");
  pagination.innerHTML = "";

  for (var i = 0; i < TG.gists.rawData.length / GH_PAGINATION; i++){
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
  var gists = TG.gists.rawData.slice(start, end);


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
    var gistDelete = '<a href="#/gists/' + gist.id + '/delete" onclick="deleteGist(\'' + gist.id + '\' );" title="Delete Gist"><i class="far fa-trash-alt"></i></a>';

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
  setDB("gists", TG.gists);
}


function initFromCache(){
  loadCache("since");
  loadCache("gists");
}


function loadCache(key){
  let lsKey = getLSKey(key);
  console.log(`Attempting to load ${key} from localStorage cache`);
  let entry = localStorage.getItem(lsKey);
  if (entry == undefined){
    console.error(`${key} / ${lsKey} not stored in localStorage!`);
    return false;
  }

  // Attempt to parse the entry as JSON if applicable
  let data = entry;
  try { data = JSON.parse(entry); } catch {}
  TG[key] = data;
}


// String capitalize
function capitalize(string){
  return string[0].toUpperCase() + string.slice(1);
}


// Helper to show a div (by ID)
function show(id){
  let el = document.getElementById(id);
  if (el == undefined){ return; }
  el.style.display = "block";
}


// Helper to hide a div (by ID)
function hide(id){
  let el = document.getElementById(id);
  if (el == undefined){ return; }
  el.style.display = "none";
}


// Helper to set the URL nav path
function setNav(page){
  window.location.hash = `#/${page}`;
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
