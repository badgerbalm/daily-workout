// Synthetic plans make coverage validation independent of today's prescriptions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {auditWorkout}=require('../scripts/audit-photos.cjs');
const root=path.resolve(__dirname,'..'),library=JSON.parse(fs.readFileSync(path.join(root,'exercise-photos.json')));
const plan=names=>({sections:[{items:names.map(name=>({name}))}]});
const report=auditWorkout(plan(['Bodyweight glute bridges','Standing calf stretch','Shoulder rolls and arm circles','Supine figure-four stretch','Future exercise']),library,root);
assert.equal(report.complete,2);assert.equal(report.partial,1);assert.equal(report.missing,2);assert.equal(report.broken,0);
assert(report.issues.some(x=>x.includes('unregistered')));
const broken=structuredClone(library);
const calf=Object.values(broken.exercises).find(e=>e.name==='Standing calf stretch');
calf.photos[0].sha256='incorrect';
assert.equal(auditWorkout(plan(['Standing calf stretch']),broken,root).broken,1,'Changed bytes must fail coverage');
calf.photos[0].src='images/../outside.jpg';
assert.equal(auditWorkout(plan(['Standing calf stretch']),broken,root).broken,1,'Traversal is not a valid photo');
assert.equal(auditWorkout(plan(['Standing calf stretch']),broken,root).complete,0,'Broken photos must not count as covered');
console.log('PASS: complete, partial, missing, unregistered and corrupted photo coverage with fixed fixtures.');
