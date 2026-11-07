// Run before publishing any plan. --strict requires complete photo coverage.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../exercise-photos.js');
function auditWorkout(workout,library,root){
 const result={total:0,complete:0,partial:0,missing:0,broken:0,issues:[]};
 for(const section of workout.sections)for(const item of section.items){
  result.total++;
  const entry=api.findExercise(library,item.name);
  if(!entry?.photos?.length){
   result.missing++;
   result.issues.push(`MISSING: ${item.name}${entry?' (registered placeholder)':' (unregistered)'}`);
   continue;
  }
  let broken=false;
  for(const photo of entry.photos){
   const file=api.localPhotoPath(photo.src)?path.join(root,photo.src):null;
   if(!file||!fs.existsSync(file)||crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==photo.sha256){
    broken=true;result.issues.push(`BROKEN: ${item.name}: ${photo.src} (invalid path, missing file, or hash mismatch)`);
   }
  }
  if(broken){result.broken++;continue}
  if(entry.status==='partial'){
   result.partial++;result.issues.push(`PARTIAL: ${item.name}: ${entry.reason||'Some movements are not pictured.'}`);
  }else result.complete++;
 }
 return result;
}
if(require.main===module){
 const root=path.resolve(__dirname,'..');
 const workout=JSON.parse(fs.readFileSync(process.argv.slice(2).find(a=>a.endsWith('.json'))||path.join(root,'workout.json')));
 const library=JSON.parse(fs.readFileSync(path.join(root,'exercise-photos.json')));
 const result=auditWorkout(workout,library,root);
 result.issues.forEach(issue=>console.log(issue));
 console.log(`${result.complete}/${result.total} exercise cards have complete photo coverage; ${result.partial} partial; ${result.missing} missing; ${result.broken} broken.`);
 if(result.broken||((result.missing||result.partial)&&process.argv.includes('--strict')))process.exitCode=1;
}
module.exports={auditWorkout};
