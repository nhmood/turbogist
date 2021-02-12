class GitHub {
  static BASE_URL = "https://api.github.com";
  static USER_URL = this.BASE_URL + "/user";
  static GIST_URL = this.BASE_URL + "/gists";
  static PAGINATION = 10;



  #accessToken;
  #requestHeaders;
  #baseRequestOpts;
  #demo = false;
  constructor(accessToken){
    this.#accessToken = accessToken;
    this.configureRequestHeaders(this.#accessToken);
    this.configureBaseRequest(this.#requestHeaders);
  }


  setDemo(){
    console.log("SETTING DEMO MODE");
    this.#demo = true;
    this.#accessToken = "";
    //GitHub.GIST_URL = GitHub.BASE_URL + "/gists/public";
    this.configureBaseRequest();
    console.log(GitHub.GIST_URL);
  }

  configureRequestHeaders(authToken){
    this.#requestHeaders = new Headers();
    this.#requestHeaders.set('Authorization', `token ${authToken}`);
    console.log(this.#requestHeaders);
    return true;
  }

  configureBaseRequest(headers){
    this.#baseRequestOpts = {
      cache: "no-cache",
      accept: "application/vnd.github.v3+json"
    }

    // If headers are passed, merge them into the base request
    // We need to remove the headers
    if (headers != undefined){
      this.#baseRequestOpts = Object.assign(this.#baseRequestOpts, {headers: headers})
    }

    console.log(this.#baseRequestOpts);
    return true;
  }

  async getUser(){
    const data = await this.#request(GitHub.USER_URL, {
      method: "GET",
      headers: this.#requestHeaders,
      cache: "no-cache"
    })
    .catch(e => { throw Error(`getUser Failed ${e}`) });

    return data;
  }


  getGists(since, page = 1){
    const pageURL = GitHub.GIST_URL + "?since=" + since.toISOString();
    const url     = pageURL + "&page=" + page;
    console.log({url});

    // Make the request to grab Gist data by since+page
    return this.#fetchGistPage(url);
  }



  #fetchGistPage(pageURL){
    console.log(pageURL);
    return this.#githubFetch(pageURL)
    // Format the gist data into an object that has the data + moreAvailable indicator
    .then(  d => { return {gists: d, moreAvailable: (d.length > 0)} })
  }


  getGist(gistID){
    console.log(`Fetching individual Gist:${gistID}`);
    let url = GitHub.GIST_URL + "/" + gistID;
    return this.#githubFetch(url);
  }


  #githubFetch(pageURL){
    console.log(this.#baseRequestOpts);

    return fetch(pageURL, this.#baseRequestOpts)
    .then(  r => { if (!r.ok){ throw Error(r.statusText) }; return r.json(); })
    .catch( e => { console.log(`Failed to fetch page ${pageURL} -> ${e}`) ;})
  }

  async #request(path, opts){
    let response = await fetch(path, opts);
    if (!response.ok){ throw Error(response.statusText) };
    let payload = await response.json();

    return payload;
  }
}

export { GitHub }
