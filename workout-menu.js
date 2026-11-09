(function(){
 'use strict';
 const dialog=document.querySelector('#workout-menu'),button=document.querySelector('#open-workout-menu');
 if(!dialog||!button)return;
 function open(){if(!dialog.open)dialog.showModal();button.setAttribute('aria-expanded','true')}
 function close(){dialog.close()}
 button.onclick=open;
 document.querySelector('#close-workout-menu').onclick=close;
 dialog.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');button.focus()});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close()}});
 window.WorkoutMenu={open,close};
})();
