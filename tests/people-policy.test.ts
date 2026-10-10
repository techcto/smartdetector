import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldNotifyPeople,maySavePersonActivity,validatePersonPreferences,PersonMatch} from '../src/lib/people-policy';
const family:PersonMatch={personId:'household-member',confidence:'confirmed',preferences:{recognize:true,saveActivity:false,notify:false,family:true}};
test('family preference only suppresses fully covered confident person-only evidence',()=>{
 assert.equal(shouldNotifyPeople({matches:[family],completeCoverage:true,otherHazard:false}),false);
 assert.equal(maySavePersonActivity(family.preferences),false);
 for(const evidence of [
  {matches:[family],completeCoverage:true,otherHazard:true},
  {matches:[family],completeCoverage:false,otherHazard:false},
  {matches:[],completeCoverage:true,otherHazard:false},
  {matches:[family,{...family,confidence:'uncertain' as const}],completeCoverage:true,otherHazard:false},
  {matches:[family,{...family,preferences:{...family.preferences,notify:true}}],completeCoverage:true,otherHazard:false},
  {matches:[{...family,preferences:{...family.preferences,recognize:false}}],completeCoverage:true,otherHazard:false},
 ])assert.equal(shouldNotifyPeople(evidence),true);
});
test('family labels do not imply consent; disabling recognition restores normal notification policy',()=>{
 assert.throws(()=>validatePersonPreferences({recognize:false,saveActivity:false,notify:false,family:true}));
 assert.throws(()=>validatePersonPreferences({recognize:true,saveActivity:true,notify:false,family:true,extra:true}));
 assert.deepEqual(validatePersonPreferences({recognize:false,saveActivity:false,notify:true,family:true}),{recognize:false,saveActivity:false,notify:true,family:true});
});
