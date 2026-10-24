/* A day-independent photograph renderer. No workout data or timer state is changed. */
(function(root){
  'use strict';
  const normalize=name=>String(name??'').normalize('NFKC').toLowerCase()
    .replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
  function findExercise(library,name){
    const key=normalize(name);
    return Object.values(library.exercises||{}).find(entry=>
      [entry.name,...(entry.aliases||[])].some(alias=>normalize(alias)===key));
  }
  function localPhotoPath(path){
    return typeof path==='string'&&/^images\/[a-z0-9/_-]+\.(jpe?g|png|webp)$/i.test(path)&&!path.includes('..');
  }
  function exerciseDemo(library,name){
    const url=findExercise(library,name)?.demo;
    return typeof url==='string'&&/^https:\/\//.test(url)?url:undefined;
  }
  function externalLink(doc,text,url){
    const a=doc.createElement('a');a.textContent=text;
    if(/^https:\/\//.test(url||'')){a.href=url;a.target='_blank';a.rel='noopener noreferrer'}
    return a;
  }
  function openPhotoGallery(viewer,photos,index,name){
    const full=viewer.querySelector('img'),stage=viewer.querySelector('.photo-stage');
    const status=viewer.querySelector('.photo-position'),caption=viewer.querySelector('.photo-caption');
    const nav=viewer.querySelector('.photo-nav');
    function show(next){
      index=(next+photos.length)%photos.length;
      const photo=photos[index];
      full.hidden=false;full.alt=photo.alt||name+' demonstration';
      status.textContent='Photo '+(index+1)+' of '+photos.length;
      caption.textContent=photo.caption||'';
      full.onerror=()=>{full.hidden=true;caption.textContent='Photo unavailable. Try another photograph.'};
      full.src='./'+photo.src;
    }
    nav.hidden=photos.length<2;
    viewer.querySelector('.photo-back').onclick=()=>viewer.close();
    viewer.querySelector('.photo-previous').onclick=()=>show(index-1);
    viewer.querySelector('.photo-next').onclick=()=>show(index+1);
    viewer.onkeydown=event=>{
      if(photos.length>1&&['ArrowLeft','ArrowRight'].includes(event.key)){
        event.preventDefault();show(index+(event.key==='ArrowLeft'?-1:1));
      }
    };
    let start;
    stage.ontouchstart=event=>{start=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null};
    stage.ontouchmove=event=>{
      if(event.touches.length!==1){start=null;return}
      if(!start||photos.length<2)return;
      const dx=event.touches[0].clientX-start.x,dy=event.touches[0].clientY-start.y;
      if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.25&&event.cancelable)event.preventDefault();
    };
    stage.ontouchcancel=()=>{start=null};
    stage.ontouchend=event=>{
      if(!start)return;
      const end=event.changedTouches[0],dx=end.clientX-start.x,dy=end.clientY-start.y;start=null;
      if(photos.length>1&&Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.25)show(index+(dx<0?1:-1));
    };
    show(index);viewer.showModal();
  }
  function renderExercisePhotos(art,body,item,library){
    const doc=art.ownerDocument,entry=findExercise(library,item.name);
    if(/^https:\/\//.test(entry?.animationPage||'')){
      const link=externalLink(doc,'Animated demonstration & form guide ↗',entry.animationPage);
      link.className='demo';body.append(link);
    }
    const photos=(entry?.photos||[]).filter(p=>localPhotoPath(p.src)).slice(0,2);
    function placeholder(){
      const span=doc.createElement('span');span.className='image-missing';
      span.textContent='Photo unavailable';art.append(span);
    }
    if(!photos.length){placeholder();return}
    for(const p of photos){
      const figure=doc.createElement('figure'),link=doc.createElement('a'),img=doc.createElement('img');
      link.href='./'+p.src;link.target='_blank';link.rel='noopener';link.title='Expand photograph';
      link.onclick=event=>{
        const viewer=doc.querySelector('#photo-viewer');
        if(!viewer?.showModal)return;
        event.preventDefault();
        openPhotoGallery(viewer,photos,photos.indexOf(p),item.name);
      };
      img.alt=p.alt||item.name+' demonstration';img.loading='lazy';img.decoding='async';
      if(p.width&&p.height){img.width=p.width;img.height=p.height}
      const credit=doc.createElement('div');credit.className='photo-credit';
      credit.append(externalLink(doc,p.title||item.name,p.source),doc.createTextNode(' · '+p.author+' · '),
        externalLink(doc,p.license,p.licenseUrl),doc.createTextNode(p.changes?' · '+p.changes:''));
      if(p.attributionUrl)credit.append(doc.createTextNode(' · '),externalLink(doc,'PTPioneer',p.attributionUrl));
      if(p.citation)credit.append(doc.createTextNode(' · '+p.citation));
      img.onerror=()=>{
        figure.remove();credit.remove();
        if(!art.querySelector('figure')&&!art.querySelector('.image-missing'))placeholder();
      };
      link.append(img);figure.append(link);
      if(p.caption){const caption=doc.createElement('figcaption');caption.textContent=p.caption;figure.append(caption)}
      art.append(figure);body.append(credit);img.src='./'+p.src;
    }
  }
  root.renderExercisePhotos=renderExercisePhotos;
  root.exerciseDemo=exerciseDemo;
  if(typeof module!=='undefined')module.exports={normalize,findExercise,localPhotoPath,exerciseDemo,renderExercisePhotos};
})(typeof window==='undefined'?globalThis:window);
