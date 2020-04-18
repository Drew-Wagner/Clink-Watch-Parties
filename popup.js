const AVATARS = [
  { noun: 'Whiskey', avatar: 'whiskey'},
  { noun: 'Martini', avatar: 'martini'},
  { noun: 'Cocktail', avatar: 'clink_blue'},
  { noun: 'Rose', avatar: 'clink_pink'}
];

const ADJECTIVES = [
  'Classy',
  'Sleezy',
  'Sexy',
  'Kinky',
  'Whiny',
  'Sassy',
  'Creepy',
  'Trashy',
  'Lovely',
  'Moany',
  'Sour',
  'Spicy'
];

chrome.tabs.executeScript({file: 'thirdparty/jquery.min.js'}, () => {
  chrome.tabs.executeScript({file: 'thirdparty/socket.io.js'}, () => {
    chrome.tabs.executeScript({file: 'content.js'});
  });
});

var step = 0;
var socket = io('https://clink-watch-party.herokuapp.com/');

setup();

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  let url = tabs[0].url;
  let query_start_index = url.lastIndexOf('?')
  let query = url.substring(query_start_index + 1);
  let queryItems = query.split('&');
  for (let k in queryItems) {
    let [key, value] = queryItems[k].split('=')
    if (key == 'party_name') {
      socket.emit('is party', value, (is) => {
        if (is) {
          partyStarted(value);
        }
      })
      return;
    }
  }
})

function setStep(s) {
  step = s
  switch (step) {
    case 0:
      $('#party-info-group').removeClass('d-none');
      $('#share-link-group').addClass('d-none');
      $('#submit-btn').removeClass('d-none').addClass('btn-primary').text('Start');
      break;
    case 1:
      $('#party-info-group').addClass('d-none');
      $('#share-link-group').removeClass('d-none');
      $('#submit-btn').addClass('d-none');
      break;
  }
}

function setup() {
  $('#share-link').click((e) => {
    $('#share-link').select();
    document.execCommand('copy');
    $('#copyLink').text('Link copied.');
  })
  $('#submit-btn').click((e) => {
    e.preventDefault();
    
    let partyName = $('#party-name').val();
    tryCreateNewParty(partyName);
  })
}

function tryCreateNewParty(partyName) {
  if (/^[a-zA-Z]+[a-zA-Z0-9]*$/.test(partyName)) {
    socket.emit('create party', partyName, (res) => {
      if (res) {
        $('#party-name').removeClass('is-invalid');
        partyStarted(partyName);
      } else {
        $('#party-name').addClass('is-invalid');
        $('#party-name-error').text('A party with that name already exists. Please choose another name.');    
      }
    })
  } else {
    $('#party-name').addClass('is-invalid');
    $('#party-name-error').text('Party names must start with a letter and contain only letters and numbers.');
  }
}

function partyStarted(party_name) {
  setStep(1);
  generateShareLink(party_name, (link) => {
    console.log(link);
    $('#share-link').val(link);
  })
  sendPartyAndUserInfoToContent(party_name)
}

function generateShareLink (name, callback) {
  getTabLocation((loc) => {
    const endIndex = loc.lastIndexOf('/');
    let base = loc.substring(0, endIndex + 1);
    base += `?autoplay=1&t=0&party_name=${name}`;
    callback(base);
  })
}

function sendPartyAndUserInfoToContent (partyName) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.storage.local.get(['nickname', 'avatar'], (res) => {
      var nickname, avatar;
      // if (res.nickname && res.avatar) {
      //   nickname = res.nickname;
      //   avatar = res.avatar;
      // } else {
        [nickname, avatar] = randomNameAndAvatar();
      //   chrome.storage.local.set({avatar})
      //   chrome.storage.local.set({nickname})
      // }
      console.log(nickname, avatar);
      chrome.tabs.sendMessage(tabs[0].id, {partyName, nickname, avatar});
    });
  });
}

function randomNameAndAvatar () {
  let obj = AVATARS[(Math.random() * (AVATARS.length - 1)).toFixed()];
  let adj = ADJECTIVES[(Math.random() * (ADJECTIVES.length - 1)).toFixed()];
  console.log(adj)
  console.log(obj);
  return [adj + ' ' + obj.noun, obj.avatar];
}

// var socket = io('http://localhost:3000');
// socket.on('connection', () => {
//   console.log('connected!')
// })

// let partyNameElement = $('#party-name');
// let partyInfoGroup = $('#party-info-group');
// let shareLinkGroup = $('#share-link-group');
// let shareLinkInput = $('#share-link');
// let partyName = '';

// let formButton = $('#submit-btn');

// shareLinkInput.click((e) => {
//   shareLinkInput.select();
//   document.execCommand('copy');
//   $('#copyLink').text('Link copied.');
// });

// formButton.click((e) => {
//   e.preventDefault()

//   if (step == 0) {
//     partyName = partyNameElement.val()

//     if (/^[a-zA-Z]+[a-zA-Z0-9]*$/.test(partyName)) {
//       tryCreateParty(partyName, (success) => {
//         if (success) {
//           generateShareLink(partyName, (shareLink) => {
//             shareLinkInput.val(shareLink);
//           });

//           partyNameElement.removeClass('is-invalid');

//           formButton.text('Stop');
//           formButton.removeClass('btn-primary');
//           formButton.addClass('btn-danger');

//           partyInfoGroup.toggleClass('d-none');
//           shareLinkGroup.toggleClass('d-none');
//           step = 1;

//           chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
//             chrome.storage.local.get(['nickname', 'avatar'], (res) => {
//               var nickname, avatar;
//               if (res.nickname) {
//                 nickname = res.nickname
//               } else {
//                 nickname = 'Anonymous' // TODO Randomly generated names?
//                 chrome.storage.local.set({nickname})
//               }
//               if (res.avatar) {
//                 avatar = res.avatar
//               } else {
//                 avatar = 'clink_blue' // TODO Random avatars
//                 chrome.storage.local.set({avatar})
//               }
//               chrome.tabs.sendMessage(tabs[0].id, {partyName, nickname, avatar});
//             })
//           })
//         } else {
//           partyNameElement.addClass('is-invalid');
//           $('#party-name-error').text('A party by that name already exists. Please choose another one.');
//         }
//       })
//     } else {
//       partyNameElement.addClass('is-invalid');
//       $('#party-name-error').text('Party names must start with a letter, and contain only letters and numbers.');
//     }
//   }
// })

function getTabLocation (callback) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    callback(tabs[0].url);
  });
}