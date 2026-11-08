// Build a separate static preview from reviewed public app assets only.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const output=process.argv[2];if(!output)throw Error('Usage: node scripts/build-preview.cjs /absolute/output/directory');
const dest=path.resolve(output);
if(dest===root||root.startsWith(dest+path.sep))throw Error('Output must not replace the source checkout');
fs.mkdirSync(dest,{recursive:true});
for(const file of ['index.html','workout.css','workout.json','exercise-photos.js','exercise-photos.json','safari-test.html','side-planks-practice.json','planks-practice.json','suitcase-carries-practice.json'])fs.copyFileSync(path.join(root,file),path.join(dest,file));
fs.cpSync(path.join(root,'images'),path.join(dest,'images'),{recursive:true});
const file=path.join(dest,'index.html');
let html=fs.readFileSync(file,'utf8').replace('<html lang="en">','<html lang="en" data-preview="safari">').replace('<title>Daily Workout</title>','<title>Daily Workout · Safari Preview</title><meta name="robots" content="noindex,nofollow">');
fs.writeFileSync(file,html);
console.log('Built Safari preview at '+dest);
