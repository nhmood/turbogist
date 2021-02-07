import {Database} from "./db/core.js"
import {GitHub} from "./github/core.js"
import * as Helpers from "./helpers.js"
import * as UI from "./ui/core.js"

console.log("turbogist v1.0");

class turbogist {
  #db;
  #gh;
  #accessToken;
  #user;
  #since;
  #getGistInProgress = false;


  constructor(){
  }


  async setup(){
    this.#db = new Database();
    await this.#db.setup();
    await this.handleAuthInit();


    this.#accessToken = localStorage.getItem("tgAccessToken");
    this.#gh = new GitHub(this.#accessToken);


    // TODO - figure out why just passing the function reference
    // doesn't scope this properly / why tg.updateGists() doesn't work
    // in the ui/core.js
    const buttonMap = [
      {hook: "updateGists", function: () => { this.updateGists() }},
      {hook: "resetGists",  function: () => { this.resetGists()  }},
      {hook: "logout",      function: () => { this.logout()      }}
    ]
    UI.setNav("");
    UI.hookButtons(buttonMap);

    // TODO - add back demo mode
    //// Check whether we are in demo mode or not
    //let isDemoMode = checkDemoMode();
    //if (isDemoMode){
    //  return demoMode();
    //}


    // TODO - move to indexedDB
    let isLoggedIn  = localStorage.getItem("tgAccessToken") != undefined;
    isLoggedIn  ? this.#setupGist() : this.#setupLogin();
  }

  async #setupGist(){
    this.#user = await this.#gh.getUser();

    // TODO - move to indexedDB
    this.#setDB("user", this.#user);
    UI.setUserUI(this.#user.login);

    // TODO - move to indexedDB
    this.#since = this.#loadCache("since") || 0;

    await this.#enableGistUI();
    await this.updateGists();
  }


  async #enableGistUI(){
    UI.toggleUI("gists");

    if (this.#since != 0){
      // Update the pagination and render the first page
      await this.#updatePagination();
      await this.renderGists(0);
    }
  }

  async #updatePagination(){
    const pageBounds = await this.#db.getPageBounds(UI.paginationSize);
    UI.updatePagination(pageBounds);
    return true;
  }

  async renderGists(page){
    const gistPage = this.#db.pageBounds[page];
    const gists = await this.#db.getGistPage(gistPage, UI.paginationSize);

    UI.renderGists(gists);

    return true;
  }


  async updateGists(){
    if (this.#getGistInProgress){
      console.log("getAllGist already in progress");
      return false;
    };

    this.#getGistInProgress = true;
    UI.refreshState("pending");

    let since = new Date(this.#since || 0);
    await this.#getGistsSince(since);

    var currentTime = new Date();
    this.#setDB("since", currentTime);
    this.#since = currentTime;

    UI.refreshState("none");
    this.#getGistInProgress = false;
  }


  async #getGistsSince(since, page = 1){
    this.#gh.getGists(since, page).then( async (data) => {
      if (data.gists.length > 0){
        console.log("Storing Data");
        console.log({data});
        this.#db.storeGists(data.gists);
      }
      this.#updatePagination();
      if (page == 1){ this.renderGists(0); }
      console.log({data});



      // If there is more data available, recursively call
      // the getGists page again with the next page
      // On return, concatenate the current page data with the next page data
      // so we can inspect/use _all_ gist records from the set of requests
      if (data.moreAvailable){
        page += 1;
        return this.#getGistsSince(since, page).then( more => {
          return data.gists.concat(more)
        })
      } else {
        console.log("No more gist data found");
        return data
      }
    })
    .catch( e => {console.log(`Failed to get gists for since:${since}/page:${page} -> ${e}`)});
  }


  resetGists(){
    this.#setDB("since", 0);
    this.#db.deleteDB();
    this.setup();
  }


  async #setupLogin(){
    UI.toggleUI("login");
  }


  // TODO - move to indexedDB
  #setDB(key, value){
    let lsKey = this.#getLSKey(key);
    localStorage.setItem(lsKey, JSON.stringify(value));
  }

  #getLSKey(key){
    return `tg${Helpers.capitalize(key)}`;
  }

  #loadCache(key){
    let lsKey = this.#getLSKey(key);
    console.log(`Attempting to load ${key} from localStorage cache`);
    let entry = localStorage.getItem(lsKey);
    if (entry == undefined){
      console.error(`${key} / ${lsKey} not stored in localStorage!`);
      return false;
    }

    // Attempt to parse the entry as JSON if applicable
    let data = entry;
    try { data = JSON.parse(entry); } catch {}
    return data;
  }



  async handleAuthInit(){
    // Check for existence of the tgAuthInit localStorage entry
    // If this isn't set, then we don't need to initialize turbogist
    // Make sure to remove the tgAuthInit so we don't rerun through
    // the auth again
    // TODO - move to indexedDB
    const authData = localStorage.getItem("tgAuthInit");
    localStorage.removeItem("tgAuthInit");

    if (authData == undefined){ return false; }

    // Parse the authData and depending on the state handle success/failure
    const auth = JSON.parse(authData);
    if (auth.state != "ok"){
      console.error(`GitHub User Authorization failed -> ${auth}`);
      Helpers.show("login_error");
    }

    // If the auth was successful, store the access token then initialize turbogist
    // TODO - move to indexedDB
    localStorage.setItem("tgAccessToken", auth.access_token);
    this.#accessToken = auth.access_token;

    this.resetGists();
    // TODO - add initial loading spinner div
  }

  logout(){
    localStorage.clear();
    this.resetGists();
    this.setup();
  }
}

const tg = new turbogist();
export {tg};

document.addEventListener("DOMContentLoaded", function() {
  tg.setup();
});
