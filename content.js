console.debug('CONTENT.JS IS RUNNING');
// DECLARE GLOBAL VARIABLES
const base_url = "http://localhost:5000"

var USERS = {
};

var mapSockIDtoUserID = {

}

var saveMessages = null;

var global_socket = io(base_url);
var myUUID;

var partyName;
var party_socket;

var showClink = false;
var typingCount = 0;

var blockEvent = {
  play: false,
  pause: false,
  seek: false
}
// ------------------------

var video;

global_socket.emit('get uuid', (id) => {
  myUUID = id;

  chrome.storage.local.get(['savedUser'], (res) => {
    if (res.savedUser) {
      USERS[myUUID] = res.savedUser;
    } else {
      // Random user
      USERS[myUUID] = {
        name: 'Anonymous Martini',
        avatar: 'martini'
      };
      chrome.storage.local.set({ savedUser: USERS[myUUID]});
    }
    injectClink();
    injectJoinParty();
  })
})

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.command) {
    if (req.command == 'toggle clink') {
        video = document.querySelector('video');
        if (!video) {
          alert('Video element not found. Please reload the page, and wait for the video to load before activating Clink!');
        } else {
          toggleClink();
        }
    }
  }
});

function toggleClink() {
  showClink = !showClink;
  $('#clink-container').toggleClass('clink-show');
  $('#dv-web-player').toggleClass('clink-show');
};

function injectClink() {
  console.log('injecting Clink');
  $('#dv-web-player').after('<div id="clink-container" class="p-2">');
}

function injectChat() {
  $('#clink-container').load(
    chrome.runtime.getURL('templates/chat.html'),
    () => {
      $('.clink-header .avatar-img').attr('data-user-id', myUUID);
      $('.clink-header .clink-party-name').text(partyName);
      updateAvatars (myUUID);

      if (saveMessages) {
        saveMessages.appendTo('.clink-chat');
        updateAvatars(myUUID);
        saveMessages = null;
      }

      configureChatListeners();
    }
  );
}

function injectJoinParty() {
  $('#clink-container').load(
    chrome.runtime.getURL('templates/join_party.html'),
    () => {
      $('.clink-logo-large').attr('src',
        chrome.runtime.getURL('images/icon128.png')
      )
      $('.avatar-selection img').each((i, el) => {
        $(el).attr('src',
          chrome.runtime.getURL(`images/avatars/${$(el).data('avatar-name')}.png`)
        );
      });

      if (!partyName) {
        var query = new URLSearchParams(window.location.search);
        $('#party-name').val(query.get('party_name'));  
      } else {
        $('#party-name').val(partyName).prop("disabled", true);
      }

      configureJoinPartyListeners();
    }
  );
}

function configureJoinPartyListeners() {
  $('form').submit((e) => {
    e.preventDefault();

    USERS[myUUID].name = $('#name-selection').val();
    USERS[myUUID].avatar = $('.avatar-selection :checked').val();

    // Open socket
    if (!party_socket) {
      partyName = $('#party-name').val();
      setupPartySocket();
    } else {
      party_socket.emit('update user', myUUID, USERS[myUUID]);
    }
    injectChat();
  })
}

function setupPartySocket() {
  party_socket = io(base_url + '/party-' + partyName);
  party_socket.emit('join party', myUUID, USERS[myUUID]);

  party_socket.on('join party', (sockID, userID, user) => {
    USERS[userID] = user;
    mapSockIDtoUserID[sockID] = userID;

    appendNotification(`${user.name} joined the party!`);
  });

  party_socket.on('attendance', () => {
    party_socket.emit('present', myUUID, USERS[myUUID]);
  });

  party_socket.on('present', (sockID, userID, user) => {
    console.log('someone is here', userID, user);

    appendNotification(`${user.name} is here.`);
    USERS[userID] = user;
    mapSockIDtoUserID[sockID] = userID;
  });

  party_socket.on('leave party', (sockID) => {
    let userID = mapSockIDtoUserID[sockID];
    if (userID) {
      appendNotification(`${USERS[userID].name} left the party.`);
      delete USERS[userID];
      delete mapSockIDtoUserID[sockID];
    } else {
      appendNotification(`Someone left the party. (We don't know who)`);
    }
  });

  party_socket.on('update user', (sockID, userID, user) => {
    if (user.name != USERS[userID].name) {
      appendNotification(`${USERS[userID].name} changed their name to ${user.name}.`);
    } else if (user.avatar != USERS[userID].avatar) {
      appendNotification(`${USERS[userID].name} changed their avatar.`);
    }
    USERS[userID] = user;
    updateAvatars(userID);

    mapSockIDtoUserID[sockID] = userID;
  });

  party_socket.on('send message', (sockID, userID, message) => {
    mapSockIDtoUserID[sockID] = sockID;

    appendMessage(userID, message);
  });

  party_socket.on('typing', (v) => {
    if (v) {
      typingCount++;
      $('.typing-indicator').removeClass('d-none');
    } else {
      if (--typingCount == 0) {
        $('.typing-indicator').addClass('d-none');
      }
    }
  })

  party_socket.on('play', (userID) => {
    appendNotification(`${USERS[userID].name} started playing the video.`);
    blockEvent.play = true;
    video.play();
  });
  party_socket.on('pause', (userID) => {
    appendNotification(`${USERS[userID].name} paused the video.`);
    blockEvent.pause = true;
    video.pause();
  });
  party_socket.on('seeked', (userID, t) => {
    appendNotification(`${USERS[userID].name} jumped forward to ${(t / 3600).toFixed()}:${(t % 3600).toFixed()}:${(t % 60).toFixed()}`)

    blockEvent.play = true;
    video.play();
    blockEvent.seek = true;
    video.currentTime = t;
    
    var wasPaused = video.paused;

    blockEvent.pause = true;
    video.pause();

    if (!wasPaused) {
      blockEvent.play = true
      video.play();
    }
  });

  video.addEventListener('playing', () => {
    console.log("PLAY");
    if (blockEvent.play) {
      blockEvent.play = false;
      return;
    }

    party_socket.emit('play', myUUID);
  });

  video.addEventListener('pause', () => {
    if (blockEvent.pause) {
      blockEvent.pause = false;
      return;
    }

    party_socket.emit('pause', myUUID);
  })

  video.addEventListener('seeked', () => {
    if (blockEvent.seek) {
      blockEvent.seek = false;
      return;
    }

    party_socket.emit('seeked', myUUID, video.currentTime + 10);
  })
}

function configureChatListeners() {
  $('#clink-chat-form textarea').keydown((e) => {
    if (e.keyCode == 13) {
      e.preventDefault();
      if ($('#clink-chat-form textarea').val())
        $('#clink-chat-form').submit();
    }
  })
  $('#clink-chat-form').submit((e) => {
    e.preventDefault();

    var msg = $('#clink-chat-form textarea').val();
    $('#clink-chat-form textarea').val('');
    party_socket.emit('send message', myUUID, msg);
    appendMessage(myUUID, msg);
  })

  $('.clink-header .avatar-img').click((e) => {
    saveMessages = $('.clink-chat li');

    injectJoinParty();
  });
}

function updateAvatars (userID) {
  if (USERS[userID]) {
    $(`.avatar-img[data-user-id=${userID}]`).attr('src',
      chrome.runtime.getURL(`images/avatars/${USERS[userID].avatar}.png`)
    );
    $(`.message-name[data-user-id=${userID}]`).text(USERS[userID].name);
  }
};

// TODO implement message IDs for deletion
function appendMessage(userID, msg) {
  $('<div>').load(
    chrome.runtime.getURL('templates/message.html'),
    (el) => {
      var $element = $(el)
      $element.find('.avatar-img').attr('data-user-id', userID).attr('src',
      chrome.runtime.getURL(`images/avatars/${USERS[userID].avatar}.png`));
      $element.find('.message-name').data('user-id', userID).text(USERS[userID].name);
      $element.find('.message-content').html(msg);
      $element.appendTo('.clink-chat');
    }
  )
}

function appendNotification(msg) {
  $('.clink-chat').append(`
  <li class="list-group-item no-shadow bg-transparent px-2">
  ${msg}
  </li>
  `);
}