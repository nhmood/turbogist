https://blog.scottlogic.com/2017/09/14/asynchronous-recursion.html
- add git clone button



https://en.wikipedia.org/wiki/Search_engine_indexing#Indexing



https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor/advance
https://stackoverflow.com/questions/35700158/jqgrid-how-to-do-pagination-with-indexeddb-client-side-data-base
https://www.freecodecamp.org/news/javascript-foreach-how-to-loop-through-an-array-in-js/
https://www.google.com/search?q=indexeddb+foreach&oq=indexeddb+foreach&aqs=chrome..69i57.2551j0j7&sourceid=chrome&ie=UTF-8
https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor#constants
https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/openKeyCursor
https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/openCursor
https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore
https://developer.mozilla.org/en-US/docs/Web/API/IDBIndex/openKeyCursor
https://bytearcher.com/articles/asynchronous-call-in-constructor/
https://medium.com/free-code-camp/a-quick-but-complete-guide-to-indexeddb-25f030425501
https://github.com/mdn/js-examples/blob/master/modules/basic-modules/modules/canvas.js
https://gist.github.com/inexorabletash/a279f03ab5610817c0540c83857e4295
https://thoughtbot.com/blog/full-text-search-in-your-browser
http://elasticlunr.com/
https://itnext.io/getting-started-with-persistent-offline-storage-with-indexeddb-1af66727246c
https://codepen.io/melnik909/pen/KGxdjY
https://freefrontend.com/css-code-examples/#sitemap-effects




    let els = document.querySelectorAll(`[data-hook=${c.hook}]`);
    els.forEach(el => {
      var searchTimeout;
      el.addEventListener('keyup', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          let search = e.target.value.toLowerCase();
          c.function(e.target.value)
        }, 250);
      });


big notes
- vercel function for api glue
- separating the UI, network, database, core logic (refactor)
- indexeddb was interesting, notes about searching, indexes, transactions (the walk thing)
- mobile/ff support - not as advanced, packers make sense now
- web workers message passing
- profiling using chrome, major GC

