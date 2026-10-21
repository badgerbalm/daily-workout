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
  function externalLink(doc,text,url){
    const a=doc.createElement('a');a.textContent=text;
    if(/^https:\/\//.test(url||'')){a.href=url;a.target='_blank';a.rel='noopener noreferrer'}
    return a;
  }
  function renderExercisePhotos(art,body,item,library){
    const doc=art.ownerDocument,entry=findExercise(library,item.name);
    const photos=(entry?.photos||[]).filter(p=>localPhotoPath(p.src)).slice(0,2);
    function placeholder(){
      const span=doc.createElement('span');span.className='image-missing';
      span.textContent='Photo unavailable';art.append(span);
    }
    if(!photos.length){placeholder();return}
    for(const p of photos){
      const figure=doc.createElement('figure'),link=doc.createElement('a'),img=doc.createElement('img');
      link.href='./'+p.src;link.target='_blank';link.rel='noopener';link.title='Open full photograph';
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
  if(typeof module!=='undefined')module.exports={normalize,findExercise,localPhotoPath,renderExercisePhotos};
})(typeof window==='undefined'?globalThis:window);
