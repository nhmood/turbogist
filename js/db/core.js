class Database {
  #version = 1;
  #dbName = "turbogist";
  #idb;

  pageBounds = [];

  constructor(){
    console.log("Setting up turbogist indexedDB");
  }

  async setup(){
    let p = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.#dbName, this.#version);
      request.onerror = (e) => { this.#setupError(event, reject); }
      request.onsuccess = (e) => { this.#setupSuccess(event, resolve); }
      request.onupgradeneeded = this.#upgradeDB;
    });

    await p;
    return this;
  }

  #setupSuccess(event, resolve){
    console.log("indexedDB setup successful");
    this.#idb = event.target.result;
    resolve(this.#idb);
  }

  #setupError(event, reject){
    console.error("indexedDB setup failed");
    console.error(event);
    reject(event);
  }

  #upgradeDB(event){
    console.log("indexedDB database upgrade required");
    const db = event.target.result;

    Database.createDB(db);
  }

  static createDB(idb){
    idb = idb || this.#idb;
    const gistStore = idb.createObjectStore("gists", {autoIncrement: false, keyPath: "id"});
    gistStore.createIndex("created_at", "created_at", { unique: false });
    gistStore.createIndex("updated_at", "updated_at", { unique: false });
    gistStore.createIndex("downloaded_at", "downloaded_at", { unique: false });
    gistStore.createIndex("pending", "pending", { unique: false });
  }

  deleteDB(){
    try {
      const session = this.#idbGenerateTransaction(["gists"], "readwrite");
      let gists = session.stores.gists;
      let request = gists.clear();
      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => resolve(event);
        request.onerror   = (event) => reject(event);
      });
    } catch(e) {
      console.error(e);
    }
  }




  //let storeMap = new Map(stores.map(s => [s, transaction.objectStore(s)]));
  #idbGenerateTransaction(stores, mode){
    const transaction = this.#idb.transaction(stores, mode);
    const storeMap = stores.reduce((map, store) => {
      map[store] = transaction.objectStore(store);
      return map;
    }, {});

    return {
      transaction: transaction,
      stores: storeMap
    }
  }

  async getPageBounds(pageSize, transaction){
    // Create or use the provided session and pull the "updated_at" index
    const session = transaction || this.#idbGenerateTransaction(["gists"], "readonly");
    const index = session.stores.gists.index("updated_at");

    // Open a key cursor in the reverse direction (latest updated first)
    // and create a container for the page bounds
    const request = index.openKeyCursor(null, "prev");
    const pageBounds = [];

    // Wrap the cursor in a Promise for easy handling
    const walk = new Promise((resolve, reject) => {
      // On success will be fired whenever the cursor moves
      request.onsuccess = (event) => {
        // Pull the result out of the event to get the Gist (ID)
        // If the cursor result has data, then we found a record and
        // we should add it to the list and keep paging
        let cursor = event.target.result;
        if (cursor != undefined){
          pageBounds.push(cursor.key);
          cursor.advance(pageSize);

        // If the cursor does not find any data, we should resolve
        // this promise with the events we have collected so far
        } else {
          resolve(pageBounds);
        }
      }

      // Handle any errors on the cursor
      request.onerror = (event) => {
        console.log(event)
      }
    });


    // Wait on the promise to complete (finish paging)
    // and return the events we have collected
    await walk;
    this.pageBounds = pageBounds;
    return pageBounds;
  }

  async getGistPage(start, pageSize, transaction){
    // Create or use the provided session and pull the "updated_at" index
    const session = transaction || this.#idbGenerateTransaction(["gists"], "readonly");
    const index = session.stores.gists.index("updated_at");

    // Open a key cursor in the reverse direction (latest updated first)
    // and create a container for the page bounds
    const request = index.openCursor(IDBKeyRange.upperBound(start), "prev");
    const gists = [];

    // Wrap the cursor in a Promise for easy handling
    const walk = new Promise((resolve, reject) => {
      // On success will be fired whenever the cursor moves
      request.onsuccess = (event) => {
        // Pull the result out of the event to get the Gist (ID)
        // If the cursor result has data, then we found a record and
        // we should add it to the list and keep paging
        let cursor = event.target.result;
        if (cursor != undefined && gists.length < pageSize){
          gists.push(cursor.value);
          cursor.continue();

        // If the cursor does not find any data, we should resolve
        // this promise with the events we have collected so far
        } else {
          resolve(gists);
        }
      }

      // Handle any errors on the cursor
      request.onerror = (event) => {
        console.log(event)
      }
    });


    // Wait on the promise to complete (finish paging)
    // and return the events we have collected
    await walk;
    return gists;
  }


  async #idbCountGists(transaction){
    const session = transaction || this.#idbGenerateTransaction(["gists"], "readonly");
    let request = session.stores.gists.count();
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => { resolve(event.target.result) };
      request.onerror   = (event) => { reject(event.target.result)  };
    })
  }


  storeGists(gists){
    const session = this.#idbGenerateTransaction(["gists"], "readwrite");
    const stores = gists.map(gist => {
      // When we batch import gists (with storeGists, compared to storeGist)
      // set the pending flag to the current timestamp
      gist.pending = new Date();
      return this.storeGist(gist, session)
    });
    return Promise.all(stores)
  }


  storeGist(gist, transaction){
    const session = transaction || this.#idbGenerateTransaction(["gists"], "readwrite");
    const gists = session.stores.gists;


    const request = gists.put(gist);
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => resolve(event);
      request.onerror   = (event) => reject(event);
    });
  }


  async getGist(id, transaction){
    const session = transaction || this.#idbGenerateTransaction(["gists"], "readonly");
    const gists = session.stores.gists;
    const request = gists.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => { resolve(event.target.result) };
      request.onerror   = (event) => { reject(event.target.result)  };
    })
  }

  async walkGists(index, gistDo){
    const session = this.#idbGenerateTransaction(["gists"], "readwrite");
    let source = session.stores.gists;

    if (index){
      source = source.index(index);
    }

    // Open a cursor on the gists
    const request = source.openCursor();

    // Wrap the cursor in a Promise for easy handling
    const walk = new Promise((resolve, reject) => {
      // On success will be fired whenever the cursor moves
      request.onsuccess = async (event) => {
        // Pull the result out of the event to get the Gist (ID)
        // If the cursor result has data, then we found a record and
        // we should add it to the list and keep paging
        let cursor = event.target.result;
        if (cursor != undefined){
          // TODO - do we want to throw an await in here, if so we need to handle
          //        the cursor transaction expiring
          gistDo(event.target.result.value);
          cursor.continue()

        // If the cursor does not find any data, we should resolve
        // this promise with the events we have collected so far
        } else {
          resolve();
        }
      }

      // Handle any errors on the cursor
      request.onerror = (event) => {
        console.log(event)
      }
    });


    // Wait on the promise to complete (finish paging)
    // and return the events we have collected
    await walk;
  }




}

export { Database }
