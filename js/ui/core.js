import {tg} from "../turbogist.js";
import * as Helpers from "../helpers.js";

export const paginationSize = 10;

export const hookButtons = (buttonMap) => {
  console.log(buttonMap);
  buttonMap.forEach(btn => {
    let els = document.querySelectorAll(`[data-hook=${btn.hook}]`);
    els.forEach(el => {
      el.addEventListener('click', btn.function);
    });
  });
};


// Helper to set the URL nav path
export const setNav = (page) => {
  window.location.hash = `#/${page}`;
};



export const setUserUI = (userLogin) => {
  // Set the GitHub User link
  var gh_link = document.getElementById("gh_link");
  gh_link.href = "https://gist.github.com/" + userLogin;
  gh_link.innerHTML = userLogin;


  // Swap out the starting loading page
  var holding = document.getElementById("startup");
  holding.style.display = "none";
  var content = document.getElementById("loaded");
  content.style.display = "block";
}

export const setLoginUI = () => {
  toggleUI("login");
}

export function toggleUI(state){
  let states = ["login", "gists"];
  for (var i = 0; i < states.length; i++){
    var div = document.getElementById(states[i]);
    div.style.display = (states[i] == state) ? "block" : "none";
  }
}


export function refreshState(state){
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

  return true;
}



export function updatePagination(pageBounds){
  // Grab and clear the current pagination
  var pagination = document.getElementById("gist_pagination");
  pagination.innerHTML = "";

  for (let i = 0; i < pageBounds.length; i++){
    var link = document.createElement("a");
    link.href = "#/page/" + (i + 1);
    link.onclick = createPaginationLink(i);
    link.innerHTML = i + 1;
    pagination.appendChild(link);
  }
}


function createPaginationLink(page) {
  return function() { tg.renderGists(page); };
}

export async function renderGists(gists){
  var table = document.getElementById("gist_list");
  // Should I use ChildNode.replaceWith()?
  table.innerHTML = "";

  // Go through all the gists and render a row
  for (var i = 0; i < gists.length; i++){
    var gist = gists[i];
    var el = document.createElement("tr");

    // Main link (lock, name + link, updated, created)
    var main = document.createElement("td");
    var isPublic = gist.public ? '<i class="fas fa-lock-open green public"></i>' : '<i class="fas fa-lock public"></i>' ;
    main.innerHTML = isPublic + " <a href='" + gist.html_url + "' target='_blank'>" + Object.keys(gist.files)[0] + "</a>";

    // Updated datetime using fuzzy string
    var updated = Helpers.fuzzyTime(gist.updated_at);
    var updated_text = ' <div class="row updated" title="' + (new Date(gist.updated_at)) + '">updated: ' + updated + '</div>';
    main.innerHTML += updated_text;

    // Updated datetime using fuzzy string
    var created = Helpers.fuzzyTime(gist.created_at);
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


function getGistEditLink(gist){
  return "https://gist.github.com/" + gist.owner.login + '/' + gist.id + '/edit';
}
