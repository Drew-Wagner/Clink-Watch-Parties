$(document).ready(() => {
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.partyName && window.contentScriptInjected !== true) {
      window.contentScriptInjected = true;

      const partyName = request.partyName;
      var user = {
        name: request.nickname, 
        avatar: request.avatar // TODO random;
      }

      const USERS = {
      }
  
      const socket = io(`https://clink-watch-party.herokuapp.com/party-${partyName}`);
      socket.emit('join party', user);
  
      injectChat();
      $('.typing-indicator').addClass('invisible');
      typeWriter($('.typing-indicator p'), 'Someone is typing...', 0, 50);
      $('#clink-header-party-name').text(partyName);
      setHeaderAvatar(user.avatar);
  
      socket.on('join party', (id, u) => {
        USERS[id] = u;
        appendNotication(`${u.name} joined the party!`);
      });
  
      socket.on('leave party', (id, u) => {
        appendNotication(`${u.name} left the party.`);
      })
  
      socket.on('update user', (id, u) => {
        USERS[id] = u;
        appendNotication(`${u.name} changed their name.`);
      })
  
      socket.on('send message', (id, message) => {
        if (USERS[id]) {
          appendMessage(message, USERS[id].avatar, USERS[id].name);
        } else {
          appendMessage(message, 'whiskey', 'Unknown');
        }
      })
  
      var typing = 0;
      socket.on('typing', (v) => {
        if (v) {
          typing++;
        } else {
          typing--;
        }
        if (typing == 0) {
          $('.typing-indicator').addClass('invisible');
        } else {
          $('.typing-indicator').removeClass('invisible');
        }
      })
  
      $('#clink-chat-textarea').keydown((e) => {
        if (e.keyCode == 13) {
          if (e.ctrlKey) {
            // emulate enter
            return false;
          }
  
          e.preventDefault();
  
          $('#clink-chat-form').submit();  
        }
      })
  
      var typingTimeout;
      $('#clink-chat-textarea').on('input', (e) => {
        clearTimeout(typingTimeout);
        if (!typingTimeout)
          socket.emit('typing', true);
        typingTimeout = setTimeout(() => {
          socket.emit('typing', false);
          typingTimeout = null;
        }, 500)
      });
  
      $('#clink-chat-form').submit((e) => {
        e.preventDefault();
        const msg = $('#clink-chat-textarea').val();
        $('#clink-chat-textarea').val('');
        console.log('append message');
        appendMessage(msg, user.avatar, user.name);
        socket.emit('send message', msg);
      });
  
      $('#clink-header-avatar-btn').click((e) => {
        e.preventDefault();
  
        $('#clink-user-settings').toggleClass('d-none');
      })

      var video = $('video')[0];
      var playCommand = false;
      var pauseCommand = false;
      var seekCommand = false;
      video.addEventListener('pause', () => {
        if (pauseCommand) {
          pauseCommand = false;
          return;
        }
        console.log('pause')
        socket.emit('pause');
        appendNotication(`${user.name} paused the video.`);
      })
      video.addEventListener('playing', () => {
        if (playCommand) {
          playCommand = false;
          return;
        }
        console.log('play')
        socket.emit('play');
        appendNotication(`${user.name} started playing the video.`);
      })
      video.addEventListener('seeked', (e) => {
        if (seekCommand) {
          seekCommand = false;
          return;
        }
        socket.emit('seeked', video.currentTime);
        appendNotication(`${user.name} jumped forward to ${(video.currentTime / 3600).toFixed()}:${(video.currentTime / 60).toFixed()}:${(video.currentTime).toFixed(2)}.`);
      })

      socket.on('pause', (id) => {
        pauseCommand = true;
        video.pause();
        appendNotication(`${USERS[id].name} paused the video.`);
      });

      socket.on('play', (id) => {
        playCommand = true;
        video.play();
        appendNotication(`${USERS[id].name} started playing the video.`);
      });

      socket.on('seeked', (id, timeStamp) => {
        playCommand = true;
        video.play();
        seekCommand = true;
        video.currentTime = timeStamp + 10;
        pauseCommand = true;

        var wasPaused = video.paused;

        video.pause();
        if (!wasPaused) {
          playCommand = true;
          video.play();
        }
        appendNotication(`${USERS[id].name} jumped forward to ${(timeStamp / 3600).toFixed()}:${((timeStamp % 3600)/60).toFixed()}:${(timeStamp % 60).toFixed(2)}.`);
      });
    }
  });  
});

function setHeaderAvatar (avatar) {
  $('#clink-header-avatar-btn img')
    .addClass(`avatar-${avatar}`)
    .attr('src', chrome.extension.getURL(`images/avatars/${avatar}.png`));
}

function injectChat () {
  $('#dv-web-player').addClass('clink-show-chat');

  if ($('.clink-chat').length == 0) {
    $('#dv-web-player').after(`
  <div class="clink-chat clink-chat-open d-flex flex-column px-1 py-2">
    <div class="col-auto">
      <div class="clink-header mb-2 row">
        <div class="col align-self-end"> 
          <div class="text-accent">Clink!</div>
          <div>
            <h4 id="clink-header-party-name"/>
          </div>
        </div>
        <div class="col-auto align-self-center">
          <div id="clink-header-avatar-btn" class="avatar-btn">
            <img class="avatar" src="" />
            <div class="overlay">
            </div>
          </div>
        </div>
      </div>
      <div id="clink-user-settings" class="d-none row mb-2">
      Sorry :( User settings aren't implemented yet...
      </div>
    </div>
    <div class="col clink-message-wrapper" style="position: relative;">
      <ul id="clink-messages" class="list-group">
      </ul>
      <div class="px-0 border-0 typing-indicator">
        <p class="mb-0 text-accent">Someone is typing</p>
      </div>
    </div>
    <div class="col-auto clink-chat-input-wrapper">
      <form id="clink-chat-form" class="form-inline row mx-0 no-gutters mt-2">
        <textarea style="resize: none;" class="col mr-2 form-control bg-dark border-dark" id="clink-chat-textarea" rows="1"></textarea>
        <div class="col-auto">
          <button type="submit" class="btn btn-sm btn-dark rounded-circle text-accent">
          <i style="margin-left: -4px;" class="text-accent fas fa-paper-plane"></i>
          </button>
        </div>
      </form>
  </div>
    `);
  }
}

// $(document).ready(() => {
//   typeWriter($('.typing-indicator p'), 'Someone is typing...', 0, 50);

//   $('#clink-chat-textarea').keydown((e) => {
//     if (e.keyCode == 13) {
//       if (e.ctrlKey) {
//         // link break
//         return true;
//       }
//       e.preventDefault();
//       $('#clink-chat-form').submit();
//     }
//   });

//   $('#clink-chat-form').submit((e) => {
//     e.preventDefault();

//     const msg = $('#clink-chat-textarea').val();
//     $('#clink-chat-textarea').val('');
//     $('#clink-chat-textarea').focus();

//     sendMessage(msg);
//   })

//   $('#dv-web-player').addClass('clink-show-chat');

//   if ($('.clink-chat').length == 0) {
//     console.log('Trying to add...');
//     $('#dv-web-player').after(`
//     `);
// }
// });

function typeWriter(target, txt, i, speed) {
  if (i <= txt.length) {
    target.text(txt.substring(0, i));
    i++;
    setTimeout(typeWriter, speed + Math.random() * speed, target, txt, i, speed);  
  } else {
    target.innerHTML = '';
    i = 0;
    setTimeout(typeWriter, speed * 10, target, txt, i, speed);  
  }
}

function appendNotication(msg) {
 $('#clink-messages').append(
`
<li class="list-group-item px-0 border-0">
  <p class="mb-0 text-accent">${msg}</p>
</li>
`
 )
}

function appendMessage(msg, avatar, name) {
  if (msg.startsWith('\\GIF:')) {
    msg = `<img src="${msg.substring(5)}"/>`
  }
  $('#clink-messages').append(
`
<li class="list-group-item px-0 border-0">
<div class="row align-items-start">
  <div class="col-auto">
    <img class="avatar avatar-${name}" src="${chrome.extension.getURL(`images/avatars/${avatar}.png`)}" />
  </div>
  <div class="col pl-0">
    <div class="flex-column align-items-start">
      <h6 class="mb-0 text-accent">${name}</h6>
      <p class="mb-1" style="word-break: break-all">
        ${msg}
      </p>
    </div>
  </div>  
</div>
</li>
`
  )

  $('.clink-message-wrapper').animate({
    scrollTop: $('#clink-messages').height()
  }, 250);
}
