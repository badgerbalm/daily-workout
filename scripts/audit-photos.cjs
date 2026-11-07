// Run before publishing any plan. --strict requires an actual photo on every card.
const fs=require('node:fs'),path=require('node:path'),api=require('../exercise-photos.js');
const root=path.resolve(__dirname,'..');
const workout=JSON.parse(fs.readFileSync(process.argv.find(a=>a.endsWith('.json'))||path.join(root,'workout.json')));
const library=JSON.parse(fs.readFileSync(path.join(root,'exercise-photos.json')));
let missing=0,broken=0,total=0;
for(const section of workout.sections)for(const item of section.items){
 total++;const entry=api.findExercise(library,item.name);
 if(!entry?.photos?.length){missing++;console.log(`MISSING: ${item.name}${entry?' (registered placeholder)':' (unregistered)'}`);continue}
 for(const photo of entry.photos){if(!api.localPhotoPath(photo.src)||!fs.existsSync(path.join(root,photo.src))){broken++;console.log(`BROKEN: ${item.name}: ${photo.src}`)}}
}
console.log(`${total-missing}/${total} exercise cards have registered photos; ${missing} missing; ${broken} broken assets.`);
if(broken||(missing&&process.argv.includes('--strict')))process.exitCode=1;
