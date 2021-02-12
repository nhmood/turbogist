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
  #demoMode = false;


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
      {hook: "logout",      function: () => { this.logout()      }},
      {hook: "demo",        function: () => { this.demoMode()    }}
    ]
    UI.setNav("");
    UI.hookButtons(buttonMap);


    const searchConfig = [
      {hook: "searchGists", function: (e) => { this.search(e) }}
    ]
    UI.hookSearch(searchConfig);


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


  async demoMode(){
    this.#db.deleteDB();
    UI.setUserUI("demo");
    this.#gh.setDemo();
    this.#demoMode = true;
    this.#since = 0;
    await this.#enableGistUI();
    await this.updateGists();
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


    // TODO - move this to background/service worker
    this.updateDictionary()
  }



  async #enableGistUI(){
    UI.toggleUI("gists");

    // If we already have available data (since is set), update the
    // pagination and render the first page
    if (this.#since != 0){
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
    if (gistPage == undefined){ return };
    const gists = await this.#db.getGistPage(gistPage, UI.paginationSize);

    UI.renderGists(gists);

    return true;
  }


  async #getGistsSince(since, page = 1){
    // Fetch paginated gists from GitHub from the specified date with
    return this.#gh.getGists(since, page).then( async (data) => {
      // Store the retrieved gists into indexedDB, update
      // the pagination on the page, and render the first page gists
      // if the current page we are on is (0) (to avoid unnecessary rerenders)
      await this.#db.storeGists(data.gists);
      await this.#updatePagination();
      if (page == 1){ this.renderGists(0); }

      if (this.#demoMode){ return };

      // If there is more data available, recursively call getGistsSince
      // with the fixed since paramter but incremented page
      if (data.moreAvailable){
        page += 1;
        return this.#getGistsSince(since, page);
      } else {
        console.log("No more gist data found");
        return true;
      }
    })
    .catch( e => {console.log(`Failed to get gists for since:${since}/page:${page} -> ${e}`)});
  }


  async updateDictionary(e){
    // Walk through all gists in DB and fetch the
    // full gist if the download_at is unset or older than
    // the updated at of the gist
    this.#db.walkGists("pending", async gist => {
      console.log(gist);
      if (gist.downloaded_at == undefined){
        console.log(`gist:${gist.id} not downloaded`);
        let data = await this.#gh.getGist(gist.id);
        data.downloaded_at = new Date();
        data.pending = null;
        await this.#db.storeGist(data);

        let entry = await this.getGistStems(data.id);
        console.log(entry);
        await this.#db.addStems(entry.id, entry.name, entry.stems);
      }
    })
  }

  async search(substr){
    console.log("searching:" + substr);
    if (substr.length == 0){ return this.renderGists(0); }
    const stems = await this.#db.searchStem(substr);
    const p = Promise.all(stems.map(stem => {return this.getGist(stem.id)}));
    const gists = await p;
    UI.renderGists(gists);
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

  async getGist(id){
    return await this.#db.getGist(id);
  }

  async getGistStems(id){
    const data = await this.getGist(id);
    const keys = Object.keys(data.files);
    const words = new Set;
    keys.map(k => {
      let content = Helpers.stemContent(data.files[k].content);
      content.forEach(w => words.add(w));
    })

    return {id: id, name: keys[0], stems: words};

    const stems = new Set;
    words.forEach(w => {
      for (let i = 1; i <= w.length; i++){
        let stem = w.slice(0, i);
        stems.add(stem)
      }
    })

    return {id: id, name: keys[0], stems: stems};
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
