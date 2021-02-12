// Strip out any nonletter/number characters, split by spaces,
// remove any empty strings, downcase
export function stemContent(content){
  let replaced = content.replace(/[^A-Za-z0-9]/g, ' ');
  let words = replaced.split(" ");
  let filtered = words.filter(e => { return e.length != 0});
  let stemmed = filtered.map(e => {return e.toLowerCase()});
  return stemmed;
}



// Sleep helper
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// String capitalize
export function capitalize(string){
  return string[0].toUpperCase() + string.slice(1);
}


// Helper to show a div (by ID)
export function show(id){
  let el = document.getElementById(id);
  if (el == undefined){ return; }
  el.style.display = "block";
}


// Helper to hide a div (by ID)
export function hide(id){
  let el = document.getElementById(id);
  if (el == undefined){ return; }
  el.style.display = "none";
}

// Friendly time
export function fuzzyTime(time){
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
